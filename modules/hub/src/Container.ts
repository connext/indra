export type Factory = (...deps: any[]) => any

export interface ServiceDefinition {
  name: string,
  factory: Factory,
  dependencies: string[],
  isSingleton: boolean
}

export type PartialServiceDefinitions = {
  [name: string]: ({ factory: Factory } & Partial<ServiceDefinition>)
}

export type ServiceDefinitions = {
  [name: string]: ServiceDefinition
}

/*
// Note: initially I had imagined that Context could be hierarchical, but in
// practice that doesn't seem to be necessary, and will likely only lead to
// subtle bugs if a "parent" context is used when a child is expected.
// I've left the implementation here for now, though, in case that assumption
// turns out to be untrue.
export class Context {
  id: string
  numChildren: number
  parent?: Context
  values: { [name: string]: any } = {}

  constructor(parent?: Context) {
    this.parent = parent
    this.numChildren = 0
    this.id = parent ? parent.id + '.' + parent.numChildren++ : 'root'
  }

  getChild() {
    return new Context(this)
  }

  get(name: string, dflt?: any): any {
    if (name in this.values)
      return this.values[name]

    if (this.parent)
      return this.parent.get(name, dflt)

    if (dflt !== undefined)
      return dflt

    throw new Error(`"${name}" not found in Context!`)
  }

  set(name: string, value: any) {
    this.values[name] = value
  }

}
*/

/**
 * A context shared between services, DAOs, etc that are part of the same
 * logical "context".
 *
 * Specifically, the three logical contexts that currently exist are:
 *
 * 1. Singletons. Each singleton is given a unique context that is shared
 *    between all of their dependencies. For example, this means that the
 *    ChainsawService will have a unique context that's shared with all of its
 *    dependencies, so when it begins a database transaction, that will be
 *    shared with all DAOs it uses.
 *
 * 2. Web requests. The ApiServer (and specifically the
 *    `ApiService.getHandler()` method) creates a new context to handle each
 *    web request.
 *
 * 3. The `TestServiceRegistry` creates a new context each time it is reset()
 *    (typically it's reset once after all tests in the `describe(...)` block
 *    have been executed, but some tests also reset it `afterEach(...)`).
 *
 * Currently (Nov 2018) the only service which makes use of the Context is
 * DBEngine, which uses it to share a transaction between all dependencies.
 * There are plans to add a log context (so, for example, all log messages will
 * contain the currently logged in user), and an authentication context (so
 * all services can access the current authentication context).
 */
export class Context {
  values: { [name: string]: any } = {}

  get(name: string, dflt?: any): any {
    if (name in this.values)
      return this.values[name]

    if (dflt !== undefined)
      return dflt

    throw new Error(`"${name}" not found in Context!`)
  }

  set(name: string, value: any) {
    this.values[name] = value
  }
}

export class Registry {
  registry: ServiceDefinitions

  constructor(otherRegistry?: Registry) {
    this.clear()

    if (otherRegistry) {
      this.bindDefinitions(otherRegistry.registry)
    }
  }

  clear(): void {
    this.registry = {}
  }

  bindDefinitions(definitions: PartialServiceDefinitions) {
    Object.keys(definitions).forEach(name => {
      const def = definitions[name]
      this.bind(name, def.factory, def.dependencies || [], def.isSingleton || false)
    })
  }

  bind(name: string, factory: Factory, dependencies: string[] = [], isSingleton: boolean = true) {
    if (this.registry[name]) {
      throw new Error(`A service named ${name} is already defined.`)
    }

    this.registry[name] = {
      name,
      factory,
      dependencies,
      isSingleton,
    }
  }

  get(name: string): ServiceDefinition {
    const service = this.registry[name]

    if (!service) {
      throw new Error(`Service with name ${name} not found`)
    }

    return service
  }

  services(): string[] {
    return Object.keys(this.registry)
  }
}

export class Container {
  private registry: Registry

  private cache: { [name: string]: any }
  private overrides: any = {}

  constructor(registry: Registry, overrides?: any) {
    this.registry = registry
    this.overrides = overrides || {}
    this.clear()
  }

  resolve<T>(name: string, overrides?: any): T {
    return this.internalResolve<T>(name, [], {
      ...this.overrides,
      ...(overrides || {}),
    })
  }

  clear(): void {
    this.cache = {}
  }

  getInstanciatedServices(): any {
    return this.cache
  }

  private internalResolve<T>(name: string, visited: string[], overrides: any) {
    if (visited[0] === name || visited[visited.length - 1] === name) {
      throw new Error(`Found cyclic dependencies: [${visited.join(',')},${name}]`)
    }

    // TODO: This is not the best hack, but it makes things more or less
    // consistent for testing.
    if (name in overrides)
      return overrides[name]

    if (name == 'Container') {
      const res = new Container(this.registry, overrides)
      res.cache = this.cache
      return res
    }

    const definition = this.registry.get(name)

    if (!definition.isSingleton) {
      return this.instantiate(definition, visited, overrides)
    }

    if (this.cache[name]) {
      return this.cache[name]
    }

    const instance = this.instantiate(definition, visited, {
      ...overrides,

      // Create new Context for each singleton. See the rules in the comment on
      // the Context class.
      Context: new Context(),
    })
    this.cache[name] = instance
    return instance as T
  }

  private instantiate<T>(definition: ServiceDefinition, visited: string[], overrides: any) {
    visited.push(definition.name)
    const dependencies = definition.dependencies.map(
      (dep: string) => this.internalResolve(dep, visited.slice(), overrides))
    const instance = definition.factory.apply(null, dependencies)
    return instance as T
  }
}
