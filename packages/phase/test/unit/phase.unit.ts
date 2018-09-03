// Copyright IBM Corp. 2014. All Rights Reserved.
// Node module: loopback-phase
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import * as assert from 'assert';
import {expect} from '@loopback/testlab';
import {Phase} from '../..';
import {Handler} from '../../src';

describe('Phase', () => {
  describe('phase.run(ctx)', () => {
    it('should execute phase handlers', async () => {
      const phase = new Phase();
      let called: boolean | undefined;
      phase.use(async ctx => {
        called = true;
      });
      await phase.run();
      assert(called === true);
    });

    it('should set the context for handlers', async () => {
      const phase = new Phase();
      phase.use(async ctx => {
        expect(ctx).to.have.property('foo', 'bar');
      });
      await phase.run({foo: 'bar'});
    });

    describe('execution order', () => {
      let called: string[];
      let mockHandler: (name: string) => Handler;

      beforeEach(() => {
        called = [];
        mockHandler = function(name: string) {
          return ctx => {
            called.push(name);
            return new Promise<void>(resolve => {
              process.nextTick(() => {
                called.push(name + '_done');
                resolve();
              });
            });
          };
        };
      });

      it('should execute phase handlers in parallel', async () => {
        const phase = new Phase({parallel: true});

        phase
          .before(mockHandler('b1'))
          .before(mockHandler('b2'))
          .use(mockHandler('h1'))
          .after(mockHandler('a1'))
          .after(mockHandler('a2'))
          .use(mockHandler('h2'));

        await phase.run();
        expect(called).to.eql([
          'b1',
          'b2',
          'b1_done',
          'b2_done',
          'h1',
          'h2',
          'h1_done',
          'h2_done',
          'a1',
          'a2',
          'a1_done',
          'a2_done',
        ]);
      });

      it('should execute phase handlers in serial', async () => {
        const phase = new Phase('x');

        phase
          .before(mockHandler('b1'))
          .before(mockHandler('b2'))
          .use(mockHandler('h1'))
          .after(mockHandler('a1'))
          .after(mockHandler('a2'))
          .use(mockHandler('h2'));
        await phase.run();
        expect(called).to.eql([
          'b1',
          'b1_done',
          'b2',
          'b2_done',
          'h1',
          'h1_done',
          'h2',
          'h2_done',
          'a1',
          'a1_done',
          'a2',
          'a2_done',
        ]);
      });
    });
  });

  describe('phase.use(handler)', () => {
    it('should add a handler that is invoked during a phase', async () => {
      const phase = new Phase();
      let invoked = false;
      phase.use(async ctx => {
        invoked = true;
      });
      await phase.run();
      expect(invoked).to.equal(true);
    });
  });

  describe('phase.after(handler)', () => {
    it('should add a handler that is invoked after a phase', async () => {
      const phase = new Phase('test');
      phase
        .use(async ctx => {
          ctx!.foo = 'ba';
        })
        .use(async ctx => {
          ctx!.foo = ctx!.foo + 'r';
        });
      phase.after(async ctx => {
        assert(ctx!.foo === 'bar');
      });
      await phase.run({});
    });
  });
});
