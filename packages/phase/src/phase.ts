// Copyright IBM Corp. 2014. All Rights Reserved.
// Node module: loopback-phase
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

// tslint:disable:no-any
export interface Context {
  [name: string]: any;
}

export type Handler = (ctx: Context) => Promise<void>;

export interface PhaseOptions {
  id?: string;
  parallel?: boolean;
}

/**
 * A slice of time in an application. Provides hooks to allow
 * functions to be executed before, during and after, the defined slice.
 * Handlers can be registered to a phase using `before()`, `use()`, or `after()`
 * so that they are placed into one of the three stages.
 *
 * ```js
 * var Phase = require('loopback-phase').Phase;
 *
 * // Create a phase without id
 * var anonymousPhase = new Phase();
 *
 * // Create a named phase
 * var myPhase1 = new Phase('my-phase');
 *
 * // Create a named phase with id & options
 * var myPhase2 = new Phase('my-phase', {parallel: true});
 *
 * // Create a named phase with options only
 * var myPhase3 = new Phase({id: 'my-phase', parallel: true});
 *
 * ```
 */

export class Phase {
  /**
   * The name or identifier of the `Phase`.
   */
  id: string;
  /**
   * options The options to configure the `Phase`
   */
  options: PhaseOptions;
  handlers: Handler[];
  beforeHandlers: Handler[];
  afterHandlers: Handler[];
  __isPhase__: boolean;

  /**
   * @param [id] The name or identifier of the `Phase`.
   * @param [options] Options for the `Phase`
   */
  constructor(id?: string | PhaseOptions, options?: PhaseOptions) {
    if (typeof id === 'string') {
      this.id = id;
    }
    if (typeof id === 'object' && options === undefined) {
      options = id;
      id = options.id;
      this.id = id!;
    }
    this.options = options || {};
    this.handlers = [];
    this.beforeHandlers = [];
    this.afterHandlers = [];
    // Internal flag to be used instead of
    // `instanceof Phase` which breaks
    // when there are two instances of
    // `require('loopback-phase')
    this.__isPhase__ = true;
  }

  /**
   * Register a phase handler. The handler will be executed
   * once the phase is launched. Handlers must callback once
   * complete. If the handler calls back with an error, the phase will immediately
   * halt execution and call the callback provided to
   * `phase.run(callback)`.
   *
   * **Example**
   *
   * ```js
   * phase.use(function(ctx, next) {
   *   // specify an error if one occurred...
   *   var err = null;
   *   console.log(ctx.message, 'world!'); // => hello world
   *   next(err);
   * });
   *
   * phase.run({message: 'hello'}, function(err) {
   *   if(err) return console.error('phase has errored', err);
   *   console.log('phase has finished');
   * });
   * ```
   */
  use(handler: Handler): this {
    this.handlers.push(handler);
    return this;
  }

  /**
   * Register a phase handler to be executed before the phase begins.
   * See `use()` for an example.
   *
   * @param handler
   */
  before(handler: Handler): this {
    this.beforeHandlers.push(handler);
    return this;
  }

  /**
   * Register a phase handler to be executed after the phase completes.
   * See `use()` for an example.
   *
   * @param handler
   */
  after(handler: Handler): this {
    this.afterHandlers.push(handler);
    return this;
  }

  /**
   * Begin the execution of a phase and its handlers. Provide
   * a context object to be passed as the first argument for each handler
   * function.
   *
   * The handlers are executed in serial stage by stage: beforeHandlers, handlers,
   * and afterHandlers. Handlers within the same stage are executed in serial by
   * default and in parallel only if the options.parallel is true,
   *
   * @param [context] The scope applied to each handler function.
   */
  async run(ctx: Context = {}) {
    await this.runHandlers(ctx, this.beforeHandlers);
    await this.runHandlers(ctx, this.handlers);
    await this.runHandlers(ctx, this.afterHandlers);
  }

  private async runHandlers(ctx: Context, handlers: Handler[]) {
    const tasks: Promise<void>[] = [];
    for (const h of handlers) {
      if (this.options.parallel) {
        tasks.push(h(ctx));
      } else {
        await h(ctx);
      }
    }
    if (this.options.parallel) {
      await Promise.all(tasks);
    }
  }

  /**
   * Return the `Phase` as a string.
   */
  toString() {
    return this.id;
  }
}
