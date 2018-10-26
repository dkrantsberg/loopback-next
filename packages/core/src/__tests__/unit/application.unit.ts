// Copyright IBM Corp. 2017,2018. All Rights Reserved.
// Node module: @loopback/core
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {Binding, Context, inject, Provider} from '@loopback/context';
import {expect} from '@loopback/testlab';
import {Application, Component, CoreBindings, CoreTags, Server} from '../..';

describe('Application', () => {
  describe('controller binding', () => {
    let app: Application;
    class MyController {}

    beforeEach(givenApp);

    it('binds a controller', () => {
      const binding = app.controller(MyController);
      expect(Array.from(binding.tagNames)).to.containEql(CoreTags.CONTROLLER);
      expect(binding.key).to.equal('controllers.MyController');
      expect(findKeysByTag(app, CoreTags.CONTROLLER)).to.containEql(
        binding.key,
      );
    });

    it('binds a controller with custom name', () => {
      const binding = app.controller(MyController, 'my-controller');
      expect(Array.from(binding.tagNames)).to.containEql(CoreTags.CONTROLLER);
      expect(binding.key).to.equal('controllers.my-controller');
      expect(findKeysByTag(app, CoreTags.CONTROLLER)).to.containEql(
        binding.key,
      );
    });

    function givenApp() {
      app = new Application();
    }
  });

  describe('component binding', () => {
    let app: Application;

    class MyComponent implements Component {}

    beforeEach(givenApp);

    it('binds a component', () => {
      app.component(MyComponent);
      expect(findKeysByTag(app, CoreTags.COMPONENT)).to.containEql(
        'components.MyComponent',
      );
    });

    it('binds a component with custom name', () => {
      app.component(MyComponent, 'my-component');
      expect(findKeysByTag(app, CoreTags.COMPONENT)).to.containEql(
        'components.my-component',
      );
    });

    it('binds controllers from a component', () => {
      class MyController {}

      class MyComponentWithControllers implements Component {
        controllers = [MyController];
      }

      app.component(MyComponentWithControllers);
      expect(
        app.getBinding('controllers.MyController').valueConstructor,
      ).to.be.exactly(MyController);
    });

    it('binds bindings from a component', () => {
      const binding = Binding.bind('foo');
      class MyComponentWithBindings implements Component {
        bindings = [binding];
      }

      app.component(MyComponentWithBindings);
      expect(app.getBinding('foo')).to.be.exactly(binding);
    });

    it('binds classes from a component', () => {
      class MyClass {}

      class MyComponentWithClasses implements Component {
        classes = {'my-class': MyClass};
      }

      app.component(MyComponentWithClasses);
      expect(app.contains('my-class')).to.be.true();
      expect(app.getBinding('my-class').valueConstructor).to.be.exactly(
        MyClass,
      );
      expect(app.getSync('my-class')).to.be.instanceof(MyClass);
    });

    it('binds providers from a component', () => {
      class MyProvider implements Provider<string> {
        value() {
          return 'my-str';
        }
      }

      class MyComponentWithProviders implements Component {
        providers = {'my-provider': MyProvider};
      }

      app.component(MyComponentWithProviders);
      expect(app.contains('my-provider')).to.be.true();
      expect(app.getSync('my-provider')).to.be.eql('my-str');
    });

    it('binds from a component constructor', () => {
      class MyComponentWithDI implements Component {
        constructor(@inject(CoreBindings.APPLICATION_INSTANCE) ctx: Context) {
          // Programmatically bind to the context
          ctx.bind('foo').to('bar');
        }
      }

      app.component(MyComponentWithDI);
      expect(app.contains('foo')).to.be.true();
      expect(app.getSync('foo')).to.be.eql('bar');
    });

    function givenApp() {
      app = new Application();
    }
  });

  describe('server binding', () => {
    it('defaults to constructor name', async () => {
      const app = new Application();
      const binding = app.server(FakeServer);
      expect(Array.from(binding.tagNames)).to.containEql(CoreTags.SERVER);
      const result = await app.getServer(FakeServer.name);
      expect(result.constructor.name).to.equal(FakeServer.name);
    });

    it('allows custom name', async () => {
      const app = new Application();
      const name = 'customName';
      app.server(FakeServer, name);
      const result = await app.getServer(name);
      expect(result.constructor.name).to.equal(FakeServer.name);
    });

    it('allows binding of multiple servers as an array', async () => {
      const app = new Application();
      const bindings = app.servers([FakeServer, AnotherServer]);
      expect(Array.from(bindings[0].tagNames)).to.containEql(CoreTags.SERVER);
      expect(Array.from(bindings[1].tagNames)).to.containEql(CoreTags.SERVER);
      const fakeResult = await app.getServer(FakeServer);
      expect(fakeResult.constructor.name).to.equal(FakeServer.name);
      const AnotherResult = await app.getServer(AnotherServer);
      expect(AnotherResult.constructor.name).to.equal(AnotherServer.name);
    });
  });

  function findKeysByTag(ctx: Context, tag: string | RegExp) {
    return ctx.findByTag(tag).map(binding => binding.key);
  }
});

class FakeServer extends Context implements Server {
  listening: boolean = false;
  constructor() {
    super();
  }
  async start(): Promise<void> {
    this.listening = true;
  }

  async stop(): Promise<void> {
    this.listening = false;
  }
}

class AnotherServer extends FakeServer {}
