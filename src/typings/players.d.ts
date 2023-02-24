import {Down} from "./down";
import {Revive} from "./revive";
import {Death} from "./death";

export type PlayerServer = {
    id: number;
    name: string;
    downs: number;
    kills: number;
    deaths: number;
    revives: number;
    revived: number;
    kdr: number;
    tks: number;
    tkd: number;
    rating: number;
}

export type Player = {
    steamId: string;
    name: string;
    servers?: PlayerServer[]
}

export type UpdatePlayersOptions = {
    playersMap: Map<string, Player>;
    deaths: Death[];
    downs: Down[];
    revives: Revive[];
}