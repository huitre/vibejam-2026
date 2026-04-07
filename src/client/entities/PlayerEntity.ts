export class PlayerEntity {
  sessionId: string;
  role: string;
  weapon: string;
  hp: number;
  maxHp: number;
  alive: boolean;
  isAttacking: boolean;
  isLocal: boolean;

  constructor(sessionId: string, role: string, isLocal: boolean) {
    this.sessionId = sessionId;
    this.role = role;
    this.weapon = "katana";
    this.hp = 100;
    this.maxHp = 100;
    this.alive = true;
    this.isAttacking = false;
    this.isLocal = isLocal;
  }

  updateFromState(state: any): void {
    this.role = state.role;
    this.weapon = state.weapon;
    this.hp = state.hp;
    this.maxHp = state.maxHp;
    this.alive = state.alive;
    this.isAttacking = state.isAttacking;
  }
}
