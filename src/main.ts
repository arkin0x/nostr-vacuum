import './style.css'
import { SimplePool } from 'nostr-tools'
import Geohash from 'latlon-geohash'

const relays = [
  // 'wss://relay.arcade.city',
  'wss://arc1.arcadelabs.co',
  // 'wss://eden.nostr.land',
  // 'wss://nostr.fmt.wiz.biz',
  // 'wss://relay.damus.io',
  // 'wss://nostr-pub.wellorder.net',
  // 'wss://relay.nostr.info',
  // 'wss://offchain.pub',
  // 'wss://nos.lol',
  // 'wss://brb.io',
  // 'wss://relay.snort.social',
  // 'wss://relay.current.fyi',
  // 'wss://nostr.relayer.se',
]

const pool = new SimplePool()

const sub = pool.sub(relays, [{ kinds: [40,42] }])

sub.on('event', event => {
  const json = JSON.parse(event.content)
  console.log(json)
})

let gh = Geohash.encode(40.689247, -74.044502, 5)
console.log(gh)

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    Testing
  </div>
`
