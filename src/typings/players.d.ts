import {Incap} from "./incap";
import {Revive} from "./revive";
import {Death} from "./death";

export type PlayerServer = {
  id: number;
  name: string;
  incaps: number;
  kills: number;
  falls: number;
  deaths: number;
  revives: number;
  revived: number;
  kdr: number;
  idr: number;
  tks: number;
  tkd: number;
  rating: number;
  damage: number;
  matches?: Set<number>;
  matchCount?: number;
  ke: number;
  de: number;
}

export type Player = {
  steamId: string;
  name: string;
  servers?: PlayerServer[]
}

export type UpdatePlayersOptions = {
  playersMap: Map<string, Player>;
  deaths: Death[];
  incaps: Incap[];
  revives: Revive[];
}

export type AveragePlayerDeath = {
  steamId: string;
  amount: string;
}