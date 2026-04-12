import { Client, Room, RoomAvailable } from "colyseus.js";
import { SamuraiJamRoomMetadata } from "../../shared/types.js";

export class NetworkManager {
  private client: Client;
  private room: Room | null = null;

  constructor() {
    this.client = new Client("ws://localhost:2567");
  }

  async getAvailableRooms(): Promise<RoomAvailable<SamuraiJamRoomMetadata>[]> {
    return this.client.getAvailableRooms<SamuraiJamRoomMetadata>("samurai_jam");
  }

  async createRoom(): Promise<Room> {
    this.room = await this.client.create("samurai_jam");
    console.log("[Network] Created room:", this.room.id);
    return this.room;
  }

  async joinRoom(roomId: string): Promise<Room> {
    this.room = await this.client.joinById(roomId);
    console.log("[Network] Joined room:", this.room.id);
    return this.room;
  }

  async connect(): Promise<Room> {
    this.room = await this.client.joinOrCreate("samurai_jam");
    console.log("[Network] Quick play room:", this.room.sessionId);
    return this.room;
  }

  getRoom(): Room | null {
    return this.room;
  }

  disconnect(): void {
    this.room?.leave();
    this.room = null;
  }
}
