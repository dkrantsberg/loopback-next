// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: loopback-phase
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import * as util from 'util';
import {Phase, Handler, Context} from './phase';
import {mergePhaseNameLists as zipMerge} from './merge-name-lists';

/**
 * An ordered list of phases.
 */
export class PhaseList {
  private _phases: Phase[];
  private _phaseMap: {[name: string]: Phase};

  constructor() {
    this._phases = [];
    this._phaseMap = {};
  }

  /**
   * Get the first `Phase` in the list.
   *
   */
  first(): Phase {
    return this._phases[0];
  }

  /**
   * Get the last `Phase` in the list.
   *
   * @returns The last phase.
   */
  last(): Phase {
    return this._phases[this._phases.length - 1];
  }

  /**
   * Add one or more phases to the list.
   *
   * @param phase The phase (or phases) to be added.
   * @returns The added phase or phases.
   */
  add(...phases: (string | Phase)[]) {
    const added: Phase[] = [];
    for (const phase of phases) {
      const p = this._resolveNameAndAddToMap(phase);
      added.push(p);
      this._phases.push(p);
    }
    return added.length === 1 ? added[0] : added;
  }

  _resolveNameAndAddToMap(phaseOrName: string | Phase) {
    let phase: Phase;

    if (typeof phaseOrName === 'string') {
      phase = new Phase(phaseOrName);
    } else {
      phase = phaseOrName;
    }

    if (phase.id in this._phaseMap) {
      throw new Error(util.format('Phase "%s" already exists.', phase.id));
    }

    if (!phase.__isPhase__) {
      throw new Error('Cannot add a non phase object to a PhaseList');
    }

    this._phaseMap[phase.id] = phase;
    return phase;
  }

  /**
   * Add a new phase at the specified index.
   * @param index The zero-based index.
   * @param phase The name of the phase to add.
   * @returns The added phase.
   */
  addAt(index: number, phase: string | Phase) {
    phase = this._resolveNameAndAddToMap(phase);
    this._phases.splice(index, 0, phase);
    return phase;
  }

  /**
   * Add a new phase as the next one after the given phase.
   * @param after The referential phase.
   * @param phase The name of the phase to add.
   * @returns The added phase.
   */
  addAfter(after: string, phase: string | Phase) {
    const ix = this.getPhaseNames().indexOf(after);
    if (ix === -1) {
      throw new Error(util.format('Unknown phase: %s', after));
    }
    return this.addAt(ix + 1, phase);
  }

  /**
   * Add a new phase as the previous one before the given phase.
   * @param before The referential phase.
   * @param phase The name of the phase to add.
   * @returns The added phase.
   */
  addBefore(before: string, phase: string | Phase) {
    const ix = this.getPhaseNames().indexOf(before);
    if (ix === -1) {
      throw new Error(util.format('Unknown phase: %s', before));
    }
    return this.addAt(ix, phase);
  }

  /**
   * Remove a `Phase` from the list.
   *
   * @param phase The phase to be removed.
   * @returns {Phase} The removed phase.
   */

  remove(phase: string | Phase) {
    const phases = this._phases;
    const phaseMap = this._phaseMap;
    let phaseId: string;

    if (!phase) return null;

    if (typeof phase === 'string') {
      phaseId = phase;
      phase = phaseMap[phaseId];
    } else {
      phaseId = phase.id;
    }

    if (!phase || !phase.__isPhase__) return null;

    phases.splice(phases.indexOf(phase), 1);
    delete this._phaseMap[phaseId];

    return phase;
  }

  /**
   * Merge the provided list of names with the existing phases
   * in such way that the order of phases is preserved.
   *
   * **Example**
   *
   * ```js
   * // Initial list of phases
   * phaseList.add(['initial', 'session', 'auth', 'routes', 'files', 'final']);
   *
   * // zip-merge more phases
   * phaseList.zipMerge([
   *   'initial', 'postinit', 'preauth', 'auth',
   *   'routes', 'subapps', 'final', 'last'
   * ]);
   *
   * // print the result
   * console.log('Result:', phaseList.getPhaseNames());
   * // Result: [
   * //   'initial', 'postinit', 'preauth', 'session', 'auth',
   * //   'routes', 'subapps', 'files', 'final', 'last'
   * // ]
   * ```
   *
   * @param names List of phase names to zip-merge
   */
  zipMerge(names: string[]) {
    if (!names.length) return;

    const mergedNames = zipMerge(this.getPhaseNames(), names);
    this._phases = mergedNames.map(function(name) {
      const existing = this.find(name);
      return existing ? existing : this._resolveNameAndAddToMap(name);
    }, this);
  }

  /**
   * Find a `Phase` from the list.
   *
   * @param id The phase identifier
   * @returns The `Phase` with the given `id`.
   */
  find(id: string) {
    return this._phaseMap[id] || null;
  }

  /**
   * Find or add a `Phase` from/into the list.
   *
   * @param id The phase identifier
   * @returns The `Phase` with the given `id`.
   */
  findOrAdd(id: string): Phase {
    const phase = this.find(id);
    if (phase) return phase;
    return this.add(id) as Phase;
  }

  /**
   * Get the list of phases as an array of `Phase` objects.
   *
   * @returns {Phase[]} An array of phases.
   */

  toArray(): Phase[] {
    return this._phases.slice(0);
  }

  /**
   * Launch the phases contained in the list. If there are no phases
   * in the list `process.nextTick` is called with the provided callback.
   *
   * @param [context] The context of each `Phase` handler.
   */

  async run(ctx?: Context) {
    const phases = this._phases;

    for (const p of phases) {
      await p.run(ctx);
    }
  }

  /**
   * Get an array of phase identifiers.
   * @returns phaseNames
   */
  getPhaseNames(): string[] {
    return this._phases.map(function(phase) {
      return phase.id;
    });
  }

  /**
   * Register a phase handler for the given phase (and sub-phase).
   *
   * **Example**
   *
   * ```js
   * // register via phase.use()
   * phaseList.registerHandler('routes', function(ctx, next) { next(); });
   * // register via phase.before()
   * phaseList.registerHandler('auth:before', function(ctx, next) { next(); });
   * // register via phase.after()
   * phaseList.registerHandler('auth:after', function(ctx, next) { next(); });
   * ```
   *
   * @param phaseName Name of an existing phase, optionally with
   *   ":before" or ":after" suffix.
   * @param handler The handler function to register
   *   with the given phase.
   */
  registerHandler(phaseName: string, handler: Handler) {
    let subphase: 'use' | 'before' | 'after' = 'use';
    const m = phaseName.match(/^(.+):(before|after)$/);
    if (m) {
      phaseName = m[1];
      subphase = m[2] as 'use' | 'before' | 'after';
    }
    const phase = this.find(phaseName);
    if (!phase) throw new Error(util.format('Unknown phase %s', phaseName));
    phase[subphase](handler);
  }
}
