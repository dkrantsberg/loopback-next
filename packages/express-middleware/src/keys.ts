// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/express-middleware
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {BindingKey} from '@loopback/context';
import {MiddlewareRegistryOptions} from './types';

export namespace ExpressBindings {
  export const EXPRESS_MIDDLEWARE_REGISTRY_OPTIONS = BindingKey.create<
    MiddlewareRegistryOptions
  >('express.middleware-registry.options');
}
