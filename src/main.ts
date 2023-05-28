import './style.css'
import { SimplePool } from 'nostr-tools'
import Geohash from 'latlon-geohash'
import { EventTemplate } from 'nostr-tools'

const relays = [
  // 'wss://relay.arcade.city',
  'wss://arc1.arcadelabs.co',
  'wss://eden.nostr.land',
  // 'wss://nostr.fmt.wiz.biz',
  // 'wss://relay.damus.io',
  'wss://nostr-pub.wellorder.net',
  // 'wss://relay.nostr.info',
  // 'wss://offchain.pub',
  'wss://nos.lol',
  // 'wss://brb.io',
  'wss://relay.snort.social',
]

const pool = new SimplePool()

// const sub = pool.sub(relays, [{ kinds: [40,42] }])

// sub.on('event', event => {
//   const json = JSON.parse(event.content)
//   console.log(json)
// })

// let gh = Geohash.encode(40.689247, -74.044502, 5)
// console.log(gh)

// document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
//   <div>
//     Testing
//   </div>
// `

const identity = '3aff5fbebd2b7dc3ec9f0246b08360acdd03e3ade97e52422461d566e2ae3cbc' // tester
// const identity = 'e8ed3798c6ffebffa08501ac39e271662bfd160f688f94c45d692d8767dd345a' // arkinox

// kind0 defines our user metadata
const kind0: EventTemplate[] = [];
// kind3 defines our user's contact list which can be used to build a social graph
const kind3: EventTemplate[] = [];
// define a nip02 tag type
type NIP02Contact = string[];

// social graph storage
const socialGraph: { [index: string]: any } = {};

// iterator for social graph updates
let iteration = 0

// init
extendSocialGraph(identity)

function isValidNIP02Contact(ptag: any): ptag is NIP02Contact {
  return Array.isArray(ptag) &&
    ptag.length >= 2 &&
    ptag.length <= 4 &&
    ptag.every(item => typeof item === 'string') &&
    ptag[0] === 'p' &&
    ptag[1].length === 64
}

function extendSocialGraph(pubkey: string, degree: number = 1) {
  // iterate over our built social graph base and extend it an additional degree to achieve a breadth-first search
  // for each contact in our social graph base, find the most recent kind3 event for that contact
  // iterate over the contacts in that kind3 event.tags and add them to our social graph under the contact's pubkey
  // build a new pool subscription for the pubkey's kind0 and kind3 events
  const sub = pool.sub(relays, [{ kinds: [3], authors: [pubkey] }])

  // kind3 defines our user's contact list which can be used to build a social graph
  const kind3: EventTemplate[] = [];

  sub.on('event', event => {
    kind3.push(event)
  });

  sub.on('eose', () => {
    // sort kind0 and kind3 by timestamp with newest first
    kind3.sort((a, b) => b.created_at - a.created_at)
    try {
      buildSocialGraph(pubkey, kind3[0].tags, degree)
    } catch (error) {
      console.log('pubkey had no contacts',error)
      iterateSocialGraph()
    }
  });

}

function buildSocialGraph(pubkey: string, contacts: NIP02Contact[], degree: number) {
  // begin building social graph
  // iterate over contacts in most recent kind3 event.tags
  // and store each pubkey in socialGraph
  for (let contact of contacts) {
    // make sure the contact is valid and isn't our own pubkey
    const contactPubkey = contact[1]
    if (
      isValidNIP02Contact(contact) &&
      contactPubkey !== identity
    ) {
      if (socialGraph.hasOwnProperty(contactPubkey)) {
        // this pubkey is already in our socialGraph.
        // increase its fwf (friends who follow) count
        socialGraph[contactPubkey].fwf = socialGraph[contactPubkey].fwf ? socialGraph[contactPubkey].fwf + 1 : 1
      } else {
        // this pubkey is not in our socialGraph. Add it.
        socialGraph[contactPubkey] = {
          pubkey: contactPubkey,
          degree,
          connection: pubkey,
          meta: {},
          lastUpdated: 0,
        }
      }
      // recurse
      // extendSocialGraph(contactPubkey, degree + 1)
    }
  }

  // we just updated all the contacts for pubkey; update its lastUpdated timestamp
  if (socialGraph.hasOwnProperty(pubkey)) {
    socialGraph[pubkey].lastUpdated = Date.now()
  }

  // keep iterating
  // pick a random contact to extend the social graph
  // const rootContacts = Object.keys(socialGraph).filter(key => socialGraph[key].degree === 1)
  // const randomContact = socialGraph[rootContacts[Math.floor(Math.random() * rootContacts.length)]]
  // console.log('random 1st degree contact:', randomContact.degree, randomContact.pubkey)
  // extendSocialGraph(randomContact.pubkey, 2)

  analyze()

  iterateSocialGraph()

}

const STALE_GRAPH = 1000 * 60 * 60 * 24 * 7 // 1 week

function iterateSocialGraph() {
  console.log('iterating...')
  // iterate over socialGraph and extend each contact's social graph
  // the amount of time since a contact's social graph was last updated determines how often we update it
  // iteration should not move to the next degree until all contacts in the current degree have been updated
  const now = Date.now()
  const graphKeys = Object.keys(socialGraph)
  if (iteration >= graphKeys.length) {
    // we've completed the graph. start over
    iteration = 0
  }
  // get contact
  let contact = graphKeys[iteration]
  // if the contact's social graph is stale and <3rd degree, update it
  if (
    now - socialGraph[contact].lastUpdated > STALE_GRAPH && 
    socialGraph[contact].degree + 1 < 4
    ) {
    extendSocialGraph(contact, socialGraph[contact].degree + 1)
    iteration++
  } else {
    // keep iterating
    iteration++
    setTimeout(iterateSocialGraph,1000)
  }
}

window.socialGraph = socialGraph

// analyze

function analyze(){
  var degrees = {};
  Object.keys(socialGraph).map(s => degrees[socialGraph[s].degree] = degrees[socialGraph[s].degree] ? degrees[socialGraph[s].degree] + 1 : 1)

  console.log('count of each degree', degrees)

  // sort top 10 fwf contacts
  // return their pubkey and fwf value
  const top10 = Object.keys(socialGraph)
    .map(s => socialGraph[s])
    .sort((a, b) => b.fwf - a.fwf)
    .slice(0, 10)
    .map(s => ({ pubkey: s.pubkey, fwf: s.fwf }))
  console.log('top 10 fwf contacts', top10)

}

// given a pubkey, return the pubkeys between it and the root or an empty array if none
// the pubkeys will be in the order of closest to your pubkey to closest to the target pubkey
function traverse(pubkey) {
  const path = []
  let current = socialGraph[pubkey]
  while (current.degree > 1) {
    path.unshift(current.connection)
    current = socialGraph[current.connection]
  }
  return path
}

window.traverse = traverse