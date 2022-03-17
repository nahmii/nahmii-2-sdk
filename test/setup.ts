import chai from 'chai'
import Mocha from 'mocha'
import proxyquire from 'proxyquire'
import sinon = require('sinon')
import sinonChai from 'sinon-chai'

const should: Chai.Should = chai.should()
const expect: Chai.ExpectStatic = chai.expect

chai.use(sinonChai)

export { should, expect, Mocha, proxyquire, sinon }
