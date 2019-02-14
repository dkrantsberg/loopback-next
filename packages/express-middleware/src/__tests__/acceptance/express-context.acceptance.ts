// Copyright IBM Corp. 2017,2018. All Rights Reserved.
// Node module: @loopback/rest
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {inject, Provider} from '@loopback/context';
import {Client, createClientForHandler, expect} from '@loopback/testlab';
import * as cors from 'cors';
import * as express from 'express';
import {RequestHandler} from 'express-serve-static-core';
import {ExpressContext} from '../../express-context';
import {middleware} from '../../middleware';

describe('HttpHandler mounted as an express router', () => {
  let client: Client;
  let expressApp: express.Application;
  let expressCtx: ExpressContext;
  let events: string[];

  beforeEach(givenExpressContext);
  beforeEach(givenExpressApp);
  beforeEach(givenClient);

  it('handles simple "GET /hello" requests', async () => {
    await client
      .get('/hello')
      .expect(200)
      .expect('Hello world!');
    expect(events).to.eql([
      'my-logger: get /hello',
      'auth: get /hello',
      'route: get /hello',
    ]);
  });

  it('handles simple "GET /greet" requests', async () => {
    await client
      .get('/greet')
      .expect(200)
      .expect('Greeting, world!');
    // No 'auth: get /greet' is recorded as the path does not match
    expect(events).to.eql(['my-logger: get /greet', 'greet: get /greet']);
  });

  it('handles simple "GET /not-found" requests', async () => {
    await client
      .get('/not-found')
      .expect(404)
      .expect('Not found');
    expect(events).to.eql([
      'my-logger: get /not-found',
      'route: get /not-found',
      'error: get /not-found',
    ]);
  });

  /**
   * This class illustrates how to use DI for express middleware
   */
  @middleware({phase: 'log', name: 'logger'})
  class LogMiddlewareProvider implements Provider<RequestHandler> {
    constructor(
      // Make it possible to inject middleware options
      @inject('middleware.logger.options', {optional: true})
      private options: Record<string, string> = {},
    ) {}

    value(): RequestHandler {
      /** We use wrap existing express middleware here too
       * such as:
       * const m = require('existingExpressMiddleware');
       * return m(this.options);
       */
      return (req, res, next) => {
        recordReq(req, this.options.name || 'logger');
        next();
      };
    }
  }

  async function givenExpressContext() {
    events = [];
    expressCtx = new ExpressContext();
    expressCtx.setMiddlewareRegistryOptions({
      phasesByOrder: ['log', 'cors', 'auth', 'route'],
    });

    expressCtx.middleware(
      (req, res, next) => {
        recordReq(req, 'auth');
        next();
      },
      {phase: 'auth', path: '/hello'},
    );

    expressCtx.middleware(cors(), {phase: 'cors'});

    expressCtx.middleware(
      (req, res, next) => {
        recordReq(req, 'greet');
        res.setHeader('content-type', 'text/plain');
        res.send('Greeting, world!');
      },
      {phase: 'route', method: 'get', path: '/greet'},
    );

    expressCtx.middleware(
      (req, res, next) => {
        recordReq(req, 'route');
        if (req.originalUrl === '/not-found') {
          throw new Error('Not found');
        }
        res.setHeader('content-type', 'text/plain');
        res.send('Hello world!');
      },
      {phase: 'route'},
    );

    expressCtx.middlewareProvider(LogMiddlewareProvider);
    expressCtx.bind('middleware.logger.options').to({name: 'my-logger'});

    expressCtx.errorMiddleware((err, req, res, next) => {
      recordReq(req, 'error');
      res.setHeader('content-type', 'text/plain');
      res.status(err.statusCode || 404);
      res.send(err.message);
    });
  }

  function recordReq(req: express.Request, name: string) {
    events.push(`${name}: ${req.method.toLowerCase()} ${req.originalUrl}`);
  }

  /**
   * Create an express app
   */
  function givenExpressApp() {
    expressApp = express();
    expressApp.use(expressCtx.requestHandler);
  }

  function givenClient() {
    client = createClientForHandler(expressApp);
  }
});
