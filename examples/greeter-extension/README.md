# @loopback/example-greeter-extension

This example project illustrates how to implement the
[Extension Point/extension pattern](https://wiki.eclipse.org/FAQ_What_are_extensions_and_extension_points%3F),
which promotes loose coupling and offers great extensibility. There are many use
cases in LoopBack 4 that fit into design pattern. For example:

- `@loopback/boot` uses `BootStrapper` that delegates to `Booters` to handle
  different types of artifacts
- `@loopback/rest` uses `RequestBodyParser` that finds the corresponding
  `BodyParsers` to parse request body encoded in different media types

## Overview

We'll use the following scenario to walk through important steps to organize the
`greet` service that allows extensible languages - each of them being supported
by a `Greeter` extension.

![greeters](greeters.png)

Various constructs from LoopBack 4, such as `Context`, `@inject.*`, and
`Component` are used to build the service in an extensible fashion.

## Define an extension point

In our scenario, we want to allow other modules to extend or customize how
people are greeted in different languages. To achieve that, we declare the
`greeter` extension point, which declares a contract as TypeScript interfaces
that extensions must conform to.

### Define interface for extensions

An extension point interacts with unknown number of extensions. It needs to
define one or more interfaces as contracts that each extension must implement.

```ts
/**
 * Typically an extension point defines an interface as the contract for
 * extensions to implement
 */
export interface Greeter {
  language: string;
  greet(name: string): string;
}
```

### Define class for the extension point

Typically an extension point is defined as a TypeScript class and bound to a
context.

```ts
/**
 * An extension point for greeters that can greet in different languages
 */
export class GreeterExtensionPoint {
  constructor(
    /**
     * Inject a getter function to fetch greeters (bindings tagged with
     * 'greeter')
     */
    @inject.getter(bindingTagFilter({extensionPoint: 'greeter'}))
    private greeters: Getter<Greeter[]>,
  ) {}
  // ...
}
```

To customize metadata such as `id` for the extension point, we can use
`@extensionPoint` to decorate the class, such as:

```ts
@extensionPoint('greeter')
export class GreeterExtensionPoint {}
```

#### Access extensions for a given extension point

To simplify access to extensions for a given extension point, we use dependency
injection to receive a `getter` function that gives us a list of greeters.

```ts
@extensionPoint('greeter')
export class GreeterExtensionPoint {
  constructor(
    /**
     * Inject a getter function to fetch greeters (bindings tagged with
     * 'greeter')
     */
    @extensions() // Sugar for @inject.getter(filterByTag({extensionPoint: 'greeter'}))
    private greeters: Getter<Greeter[]>, // ...
  ) {}
}
```

Please note that it's possible to add/remove greeters after the extension point
is instantiated. The injected getter function always pick up the latest list of
greeters. For example:

```ts
// Get the latest list of greeters
const greeters = await this.greeters();
```

#### Implement the delegation logic

Typically, the extension point implementation will get a list of registered
extensions. For example, when a person needs to be greeted in a specific
language, the code iterates through all greeters to find an instance that
matches the language.

```ts
/**
 * Greet in the given language
 * @param language Language code
 * @param name Name
 */
async greet(language: string, name: string): Promise<string> {
  let greeting: string = '';
  // Get the latest list of greeters
  const greeters = await this.greeters();
  // Find a greeter that can speak the given language
  for (const greeter of greeters) {
    if (greeter.language === language) {
      greeting = greeter.greet(name);
      break;
    }
  }
  if (!greeting) {
    // Fall back to English
    greeting = `Hello, ${name}`;
  }
  if (this.options && this.options.color) {
    greeting = chalk.keyword(this.options.color)(greeting);
  }
  return greeting;
}
```

## Implement an extension

Modules that want to connect to `greeter` extension point must implement
`Greeter` interface in their extension. The key attribute is that the
`GreeterExtensionPoint` being extended knows nothing about the module that is
connecting to it beyond the scope of that contract. This allows `greeters` built
by different individuals or companies to interact seamlessly, even without their
knowing much about one another.

```ts
import {Greeter, asGreeter} from '../types';
import {bind, inject} from '@loopback/context';

/**
 * Options for the Chinese greeter
 */
export interface ChineseGreeterOptions {
  // Name first, default to `true`
  nameFirst: boolean;
}

/**
 * A greeter implementation for Chinese
 */
@bind(asGreeter)
export class ChineseGreeter implements Greeter {
  language = 'zh';

  @inject('greeters.ChineseGreeter.options', {optional: true})
  private options?: ChineseGreeterOptions;

  greet(name: string) {
    if (this.options && this.options.nameFirst === false) {
      return `你好，${name}！`;
    }
    return `${name}，你好！`;
  }
}
```

## Register an extension point

To register an extension point, we simply bind the implementation class to a
`Context`. For example:

```ts
app
  .bind('greeter-extension-point')
  .toClass(GreeterExtensionPoint)
  .inScope(BindingScope.SINGLETON);
```

**NOTE**: Your extension point may choose to use a different binding scope.

The process can be automated with a component:

```ts
import {createBindingFromClass} from '@loopback/context';
import {Component} from '@loopback/core';
import {GreeterExtensionPoint} from './greeter-extension-point';

export class GreeterComponent implements Component {
  bindings = [
    createBindingFromClass(GreeterExtensionPoint, {
      key: 'greeter-extension-point',
    }),
  ];
}
```

## Register extensions

To connect an extension to an extension point, we just have to bind the
extension to the `Context` and tag the binding with
`{extensionPoint: 'greeter'}`.

```ts
app
  .bind('greeters.FrenchGreeter')
  .toClass(FrenchGreeter)
  .apply(asGreeter);
```

Please note `asGreeter` is a binding template function, which is equivalent as
configuring a binding with `{extensionPoint: 'greeter'}` tag and in the
`SINGLETON` scope.

```ts
/**
 * A binding template for greeter extensions
 * @param binding
 */
export const asGreeter: BindingTemplate = binding =>
  binding.inScope(BindingScope.SINGLETON).tag({extensionPoint: 'greeter'});
```

## Configure an extension point

Sometimes it's desirable to make the extension point configurable. Two steps are
involved to achieve that.

1. Declare an injection for the configuration for your extension point class:

```ts
export class GreeterExtensionPoint {
  constructor(
    // ...
    private greeters: Getter<Greeter[]>,
    /**
     * An extension point should be able to receive its options via dependency
     * injection.
     */
    @configuration() // Sugar for @inject('greeter-extension-point.options', {optional: true})
    private options?: GreeterExtensionPointOptions,
  ) {}
}
```

2. Set configuration for the extension point

```ts
// Configure the extension point
app.bind('greeter-extension-point.options').to({color: 'blue'});
```

## Configure an extension

Some extensions also support customization. The approach is similar as how to
configure an extension point.

1. Declare an injection for the configuration in the extension class

```ts
export class ChineseGreeter implements Greeter {
  language = 'zh';

  @inject('greeters.ChineseGreeter.options', {optional: true})
  private options?: ChineseGreeterOptions;
}
```

2. Set configuration for the extension

```ts
// Configure the ChineseGreeter
app.bind('greeters.ChineseGreeter.options').to({nameFirst: false});
```

## Contributions

- [Guidelines](https://github.com/strongloop/loopback-next/blob/master/docs/CONTRIBUTING.md)
- [Join the team](https://github.com/strongloop/loopback-next/issues/110)

## Tests

Run `npm test` from the root folder.

## Contributors

See
[all contributors](https://github.com/strongloop/loopback-next/graphs/contributors).

## License

MIT
