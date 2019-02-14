// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/express-middleware
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {Binding, ContextView, inject} from '@loopback/context';
import * as express from 'express';
import {Router} from 'express-serve-static-core';
import {ExpressBindings} from './keys';
import {middlewareFilter} from './middleware';
import {
  MiddlewareHandler,
  MiddlewareRegistryOptions,
  ExpressRequestMethod,
} from './types';
import debugFactory = require('debug');
const debug = debugFactory('loopback:rest:middleware');

/**
 * A phase of express middleware
 */
export type MiddlewarePhase = {
  /**
   * Middleware phase name
   */
  phase: string;
  /**
   * Bindings for middleware within the phase
   */
  bindings: Readonly<Binding<MiddlewareHandler>>[];
};

/**
 * A context-based registry for express middleware
 */
export class MiddlewareRegistry {
  constructor(
    @inject.view(middlewareFilter)
    protected middlewareView: ContextView<MiddlewareHandler>,
    @inject(ExpressBindings.EXPRESS_MIDDLEWARE_REGISTRY_OPTIONS, {
      optional: true,
    })
    protected options: MiddlewareRegistryOptions = {
      parallel: false,
      phasesByOrder: [],
    },
  ) {}

  setPhasesByOrder(phases: string[]) {
    this.options.phasesByOrder = phases || [];
  }

  /**
   * Get middleware phases ordered by the phase
   */
  protected getMiddlewarePhasesByOrder(): MiddlewarePhase[] {
    const bindings = this.middlewareView.bindings;
    const phases = this.sortMiddlewareBindingsByPhase(bindings);
    if (debug.enabled) {
      debug(
        'Middleware phases: %j',
        phases.map(phase => ({
          phase: phase.phase,
          bindings: phase.bindings.map(b => b.key),
        })),
      );
    }
    return phases;
  }

  /**
   * Get the phase for a given middleware binding
   * @param binding Middleware binding
   */
  protected getMiddlewarePhase(
    binding: Readonly<Binding<MiddlewareHandler>>,
  ): string {
    const phase = binding.tagMap.phase || '';
    debug(
      'Binding %s is configured with middleware phase %s',
      binding.key,
      phase,
    );
    return phase;
  }

  /**
   * Sort the middleware bindings so that we can start/stop them
   * in the right order. By default, we can start other middleware before servers
   * and stop them in the reverse order
   * @param bindings Middleware bindings
   */
  protected sortMiddlewareBindingsByPhase(
    bindings: Readonly<Binding<MiddlewareHandler>>[],
  ) {
    // Phase bindings in a map
    const phaseMap: Map<
      string,
      Readonly<Binding<MiddlewareHandler>>[]
    > = new Map();
    for (const binding of bindings) {
      const phase = this.getMiddlewarePhase(binding);
      let bindingsInPhase = phaseMap.get(phase);
      if (bindingsInPhase == null) {
        bindingsInPhase = [];
        phaseMap.set(phase, bindingsInPhase);
      }
      bindingsInPhase.push(binding);
    }
    // Create an array for phase entries
    const phases: MiddlewarePhase[] = [];
    for (const [phase, bindingsInPhase] of phaseMap) {
      phases.push({phase: phase, bindings: bindingsInPhase});
    }
    // Sort the phases
    return phases.sort((p1, p2) => {
      const i1 = this.options.phasesByOrder.indexOf(p1.phase);
      const i2 = this.options.phasesByOrder.indexOf(p2.phase);
      if (i1 !== -1 || i2 !== -1) {
        // Honor the phase order
        return i1 - i2;
      } else {
        // Neither phase is in the pre-defined order
        // Use alphabetical order instead so that `1-phase` is invoked before
        // `2-phase`
        return p1.phase < p2.phase ? -1 : p1.phase > p2.phase ? 1 : 0;
      }
    });
  }

  /**
   * Mount middleware to the express router
   *
   * @param expressRouter An express router. If not provided, a new one
   * will be created.
   */
  async mountTo(expressRouter = express.Router()): Promise<Router> {
    const phases = this.getMiddlewarePhasesByOrder();
    const middleware = await this.middlewareView.values();
    const bindings = this.middlewareView.bindings;
    for (const phase of phases) {
      const bindingsInPhase = phase.bindings;
      for (const binding of bindingsInPhase) {
        const index = bindings.indexOf(binding);
        if (binding.tagMap && binding.tagMap.path) {
          // Add the middleware to the given path
          debug(
            'Adding middleware (binding: %s): %j',
            binding.key,
            binding.tagMap,
          );
          if (binding.tagMap.method) {
            // For regular express routes, such as `all`, `get`, or `post`
            // It corresponds to `app.get('/hello', ...);`
            const method = binding.tagMap.method as ExpressRequestMethod;
            expressRouter[method](binding.tagMap.path, middleware[index]);
          } else {
            // For middleware, such as `app.use('/api', ...);`
            // The handler function can be an error handler too
            expressRouter.use(binding.tagMap.path, middleware[index]);
          }
        } else {
          // Add the middleware without a path
          if (debug.enabled) {
            debug(
              'Adding middleware (binding: %s): %j',
              binding.key,
              binding.tagMap || {},
            );
          }
          expressRouter.use(middleware[index]);
        }
      }
    }
    return expressRouter;
  }
}
