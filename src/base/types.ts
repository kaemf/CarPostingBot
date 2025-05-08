import { Telegraf } from "telegraf"
import { Update } from "telegraf/typings/core/types/typegram"
import { Context } from "telegraf/typings/context"
import Operation from "./operation"
import { UserScriptState } from "../data/UserScriptState";

type ActionType<T> = (ctx: Context<Update>, user: {[x: string]: string}, set: (key: string) => (value: string) => Promise<number>, additionalData: T) => void;

export type Message = (startState: UserScriptState, action: ActionType<Operation>) => Telegraf<Context<Update>>