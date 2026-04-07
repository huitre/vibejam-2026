import { Client, Room } from "colyseus.js";

export class NetworkManager {
  private client: Client;
  private room: Room | null = null;

  constructor() {
    this.client = new Client("ws://localhost:2567");
  }

  async connect(): Promise<Room> {
    this.room = await this.client.joinOrCreate("samurai_jam");
    console.log("[Network] Joined room:", this.room.sessionId);
    return this.room;
  }

  getRoom(): Room | null {
    return this.room;
  }

  disconnect(): void {
    this.room?.leave();
  }
}
