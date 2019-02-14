// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/express-middleware
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {
  Constructor,
  Context,
  ContextView,
  createBindingFromClass,
  Provider,
} from '@loopback/context';
import * as express from 'express';
import {ExpressBindings} from './keys';
import {asMiddlewareBinding, middlewareFilter} from './middleware';
import {MiddlewareRegistry} from './middleware-registry';
import {
  MiddlewareErrorHandler,
  MiddlewareHandler,
  MiddlewareRegistryOptions,
  MiddlewareRequestHandler,
  MiddlewareSpec,
} from './types';

export class ExpressContext extends Context {
  public static readonly ERROR_PHASE = '$error';
  public static readonly FINAL_PHASE = '$final';

  private _middlewareNameKey = 1;
  private _middlewareView?: ExpressMiddlewareView;
  private _router?: express.Router;

  public readonly requestHandler: express.RequestHandler;

  constructor(parent?: Context) {
    super(parent, 'express');

    this.requestHandler = async (req, res, next) => {
      if (this._router == null) {
        this._middlewareView = new ExpressMiddlewareView(this);
        let options = await this.get(
          ExpressBindings.EXPRESS_MIDDLEWARE_REGISTRY_OPTIONS,
          {optional: true},
        );
        options = Object.assign({phasesByOrder: []}, options);
        options.phasesByOrder = options.phasesByOrder.concat([
          ExpressContext.ERROR_PHASE,
          ExpressContext.FINAL_PHASE,
        ]);

        const middlewareRegistry = new MiddlewareRegistry(
          this._middlewareView,
          options,
        );
        this._router = express.Router();
        await middlewareRegistry.mountTo(this._router);
      }
      return this._router(req, res, next);
    };
  }

  setMiddlewareRegistryOptions(options: MiddlewareRegistryOptions) {
    this.bind(ExpressBindings.EXPRESS_MIDDLEWARE_REGISTRY_OPTIONS).to(options);
    this.invalidateRouter();
  }

  /**
   * Register a middleware handler function
   * @param handler
   * @param spec
   */
  middleware(handler: MiddlewareRequestHandler, spec: MiddlewareSpec = {}) {
    this.validateSpec(spec);
    const name = spec.name || `_${this._middlewareNameKey++}`;
    this.bind(`middleware.${name}`)
      .to(handler)
      .apply(asMiddlewareBinding(spec));
  }

  private validateSpec(spec: MiddlewareSpec = {}) {
    if (spec.method && !spec.path) {
      throw new Error(`Route spec for ${spec.method} must have a path.`);
    }
  }

  errorMiddleware(handler: MiddlewareErrorHandler, spec: MiddlewareSpec = {}) {
    spec = Object.assign(spec, {phase: ExpressContext.ERROR_PHASE});
    const name = spec.name || `_${this._middlewareNameKey++}`;
    this.bind(`middleware.${name}`)
      .to(handler)
      .apply(asMiddlewareBinding(spec));
  }

  /**
   * Register a middleware provider class
   * @param providerClass
   * @param spec
   */
  middlewareProvider(
    providerClass: Constructor<Provider<MiddlewareRequestHandler>>,
    spec: MiddlewareSpec = {},
  ) {
    const binding = createBindingFromClass(providerClass, {
      namespace: 'middleware',
      name: spec.name,
    }).apply(asMiddlewareBinding(spec));
    this.validateSpec(binding.tagMap);
    this.add(binding);
  }

  invalidateRouter() {
    this._router = undefined;
    if (this._middlewareView) {
      this._middlewareView.close();
      this._middlewareView = undefined;
    }
  }
}

/**
 * A view for express middleware
 */
class ExpressMiddlewareView extends ContextView<MiddlewareHandler> {
  constructor(context: ExpressContext) {
    super(context, middlewareFilter);
  }

  refresh() {
    super.refresh();
    (this.context as ExpressContext).invalidateRouter();
  }
}
