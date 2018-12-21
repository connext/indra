Testing

There are a number of helper functions to make testing easier::

   import { assert, getChannelState, updateState, assertStateEqual } from 'client/testing'

   describe('confirm deposit', () => {
      const preDepositState = getChannelState('empty', {
         balanceWei: [0, 0],
         pendingDepositWei: [6, 9],
      })

      it('should add the correct amount', () => {
         let actual = confirmDeposit(preDepositState)
         assertStateEqual(actual, {
            balanceWei: [6, 9],
            pendingDepositWei: [0, 0],
         })
      })
   })

Notice that:

1. The testing library provides four "default" states: "empty" (where all fields
   are zero, except for the ``txCount``, which is ``[1, 1]`` or ``1`` for channels and threads, respectively), and "full", where
   each field has a unique value (this is useful for testing, ex, signature
   functions).

   ``empty`` channel state::

      contractAddress: '0xCCC0000000000000000000000000000000000000'
      user: '0xAAA0000000000000000000000000000000000000'
      recipient: '0x2220000000000000000000000000000000000000'
      balanceWei: [ '0', '0' ]
      balanceToken: [ '0', '0' ]
      pendingDepositWei: [ '0', '0' ]
      pendingDepositToken: [ '0', '0' ]
      pendingWithdrawalWei: [ '0', '0' ]
      pendingWithdrawalToken: [ '0', '0' ]
      txCount: [ 1, 1 ],
      threadRoot: '0x0000000000000000000000000000000000000000000000000000000000000000'
      threadCount: 0
      timeout: 0
      sig: [ '', '' ]


   ``full`` channel state::

      contractAddress: '0xCCC0000000000000000000000000000000000000'
      user: '0xAAA0000000000000000000000000000000000000'
      recipient: '0x2220000000000000000000000000000000000000'
      balanceWei: [ '1', '2' ]
      balanceToken: [ '3', '4' ]
      pendingDepositWei: [ '4', '5' ]
      pendingDepositToken: [ '6', '7' ]
      pendingWithdrawalWei: [ '8', '9' ]
      pendingWithdrawalToken: [ '10', '11' ]
      txCount: [ 13, 12 ]
      threadRoot: '0x1414140000000000000000000000000000000000000000000000000000000000'
      threadCount: 14
      timeout: 15
      sig: [ 'sighub0000000000000000000000000000000000000000000000000000000000', 'siguser0000000000000000000000000000000000000000000000000000000000' ] 


   ``empty`` thread state::

      contractAddress: '0xCCC0000000000000000000000000000000000000'
      user: '0xAAA0000000000000000000000000000000000000'
      sender: '0x2220000000000000000000000000000000000000'
      receiver: '0x3330000000000000000000000000000000000000'
      txCount: 1
      balanceWei: [ '0', '0' ]
      balanceToken: [ '0', '0' ]
      sigA: ''


   ``full`` thread state::

      contractAddress: '0xCCC0000000000000000000000000000000000000'
      user: '0xAAA0000000000000000000000000000000000000'
      sender: '0x2220000000000000000000000000000000000000'
      receiver: '0x3330000000000000000000000000000000000000'
      balanceWei: [ '1', '2' ]
      balanceToken: [ '3', '4' ]
      txCount: 22
      sigA: 'sigA0000000000000000000000000000000000000000000000000000000000'

2. All operations support "shorthands" for values; internally, ``balanceWei:
   [5, 10]`` is expanded to ``balanceWeiHub: 6, balanceWeiUser: 9``. This is done
   through two functions: ``expandChannelSuccinct``, ``expandThreadSuccinct``, which expands the fields in a
   "succinct" state to a verbose state, and ``makeSuccinctChannel`` and ``makeSuccinctThread``, which do the
   opposite.

   Note that these functions can accept partial states, and combinations of
   succinct and verbose states.

   Additionally, they will always normalize numeric values to strings.

   For example::
   

      > verbose = expandSuccinctChannel({
      .   balanceWei: [6, 9],
      .   balanceTokenUser: 69,
      .   timout: 5,
      . })
      > verbose
      {
        balanceWeiHub: '6',
        balanceTokenUser: '9',
        balanceTokenUser: '69',
        timeout: 5,
      }
      > makeSuccinctChannel(verbose)
      {
        balanceWei: ['6', '9'],
        balanceToken: ['0', '69'],
        timeout: 5,
     }
      
Additionally, useful helper functions:

* ``mkAddress(prefix)``: Generates an address by suffixing ``prefix`` with zeros::

   > mkAddress('0x1234')
   '0x1234000000000000000000000000000000000000'

* ``mkHash(prefix)``: Generates a hash by suffixing ``prefix`` with zeros::

   > mkHash('0xab')
   '0xab00000000000000000000000000000000000000000000000000000000000000'
