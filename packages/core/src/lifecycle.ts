// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: @loopback/core
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {
  Binding,
  BindingFilter,
  BindingScope,
  BindingType,
  Constructor,
  ValueOrPromise,
} from '@loopback/context';
import {CoreTags} from './keys';

/**
 * Observers to handle life cycle start/stop events
 */
export interface LifeCycleObserver {
  preStart?(): ValueOrPromise<void>;
  start?(): ValueOrPromise<void>;
  postStart?(): ValueOrPromise<void>;
  preStop?(): ValueOrPromise<void>;
  stop?(): ValueOrPromise<void>;
  postStop?(): ValueOrPromise<void>;
}

const lifeCycleMethods: (keyof LifeCycleObserver)[] = [
  'preStart',
  'start',
  'postStart',
  'preStop',
  'stop',
  'postStop',
];

/**
 * Test if an object implements LifeCycleObserver
 * @param obj An object
 */
export function isLifeCycleObserver(obj: {
  [name: string]: unknown;
}): obj is LifeCycleObserver {
  return lifeCycleMethods.some(m => typeof obj[m] === 'function');
}

/**
 * Test if a class implements LifeCycleObserver
 * @param ctor A class
 */
export function isLifeCycleObserverClass(
  ctor: Constructor<unknown>,
): ctor is Constructor<LifeCycleObserver> {
  return ctor.prototype && isLifeCycleObserver(ctor.prototype);
}

/**
 * Configure the binding as life cycle observer
 * @param binding Binding
 */
export function asLifeCycleObserverBinding<T = unknown>(binding: Binding<T>) {
  return binding
    .tag(CoreTags.LIFE_CYCLE_OBSERVER)
    .inScope(BindingScope.SINGLETON);
}

/**
 * Find all life cycle observer bindings. By default, a constant or singleton
 * binding tagged with `CoreTags.LIFE_CYCLE_OBSERVER`
 */
export const lifeCycleObserverFilter: BindingFilter = binding =>
  (binding.type === BindingType.CONSTANT ||
    binding.scope === BindingScope.SINGLETON) &&
  binding.tagMap[CoreTags.LIFE_CYCLE_OBSERVER] != null;
