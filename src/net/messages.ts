import type { Tamon } from '../state/GameState'
import type { MapId } from '../world/maps'

export interface Peer {
  name: string
  map: MapId
  x: number
  y: number
  dir: number
}

export type ClientMsg =
  | { t: 'auth'; token: string }
  | { t: 'ready'; on: boolean }
  | { t: 'place'; map: MapId; x: number; y: number; dir: number }
  | { t: 'challenge'; name: string }
  | { t: 'answer'; from: string; yes: boolean }
  | { t: 'move'; battle: string; move: string }
  | { t: 'done' }

export type ServerMsg =
  | { t: 'online'; names: string[] }
  | { t: 'here'; players: Peer[] }
  | { t: 'challenge'; from: string }
  | { t: 'declined'; from: string }
  | { t: 'start'; battle: string; foeName: string; foe: Tamon }
  | { t: 'go'; battle: string; foeMove: string; seed: number }
  | { t: 'abort'; battle: string; text: string }
  | { t: 'error'; text: string }
  | { t: 'ok'; text: string }
