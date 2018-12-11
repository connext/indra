1. Utils is not a static library because we want to mock it, which means it
   needs to be aligned with our dependency injection framework.
   -  mocking it in the hub test to generate fake state updates that pass
      validation
2. Validate exchange BN division and rounding between Hub and Client
3. ExchangeArgumentsBN -> ExchangeArgsBN
