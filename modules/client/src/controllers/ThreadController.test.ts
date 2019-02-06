import { MockConnextInternal, MockStore } from '../testing/mocks'
import { mkAddress } from '../testing';

describe('ThreadController: unit tests', () => {
    let connext: MockConnextInternal
    const mockStore = new MockStore()

    beforeEach(async () => {
        connext = new MockConnextInternal()
    })
    
    describe('OpenThread', () => {
        it('should work for first thread', async () => {

        })

        it('should work for subsequent threads', async() => {

        })

        it('should work with new sender/receiver', async() => {

        })
        
        it('should fail if the thread already exists and is open', async() => {

        })

        it('should fail if the thread with that ID was already closed', async() => {

        })
    })

    describe('CloseThread', () => {
        it('should work', async () => {

        }) 

        it('should fail if the thread with that ID was already closed', async() => {

        })
    })
})