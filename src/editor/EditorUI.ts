import type { ModelCatalog } from './ModelCatalog';

export interface EditorUICallbacks {
  onSelectModel: (name: string) => void;
  onExport: () => void;
  onImport: (json: string) => void;
  onClearAll: () => void;
  onGridResize: (width: number, depth: number) => void;
  onToggleCollisionMode: () => void;
  onToggleSpawnMode: () => void;
  onToggleRampMode: () => void;
}

export class EditorUI {
  private selectedBtn: HTMLButtonElement | null = null;
  private previewImg: HTMLImageElement;
  private infoEl: HTMLDivElement;
  private modelListEl: HTMLDivElement;
  private collisionBtn: HTMLButtonElement;
  private spawnBtn: HTMLButtonElement;
  private rampBtn: HTMLButtonElement;

  constructor(
    private catalog: ModelCatalog,
    private callbacks: EditorUICallbacks,
  ) {
    this.modelListEl = document.getElementById('model-list') as HTMLDivElement;
    this.infoEl = document.getElementById('selected-info') as HTMLDivElement;
    this.collisionBtn = document.getElementById('btn-collision') as HTMLButtonElement;
    this.spawnBtn = document.getElementById('btn-spawn') as HTMLButtonElement;
    this.rampBtn = document.getElementById('btn-ramp') as HTMLButtonElement;

    // Create preview image
    const previewContainer = document.getElementById('preview-container')!;
    this.previewImg = document.createElement('img');
    this.previewImg.width = 256;
    this.previewImg.height = 256;
    this.previewImg.style.display = 'none';
    previewContainer.appendChild(this.previewImg);

    this.buildModelList();
    this.bindControls();
  }

  private buildModelList(): void {
    const names = this.catalog.getModelNames();
    for (const name of names) {
      const btn = document.createElement('button');
      btn.textContent = name;
      btn.addEventListener('click', () => this.selectModel(name, btn));
      this.modelListEl.appendChild(btn);
    }
  }

  private async selectModel(name: string, btn: HTMLButtonElement): Promise<void> {
    if (this.selectedBtn) this.selectedBtn.classList.remove('active');
    this.selectedBtn = btn;
    btn.classList.add('active');

    this.callbacks.onSelectModel(name);

    // Render preview
    const dataUrl = await this.catalog.renderPreview(name);
    this.previewImg.src = dataUrl;
    this.previewImg.style.display = 'block';
  }

  private bindControls(): void {
    document.getElementById('btn-export')!.addEventListener('click', () => {
      this.callbacks.onExport();
    });

    document.getElementById('btn-import')!.addEventListener('click', () => {
      const fileInput = document.getElementById('file-import') as HTMLInputElement;
      fileInput.click();
    });

    (document.getElementById('file-import') as HTMLInputElement).addEventListener(
      'change',
      (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          this.callbacks.onImport(reader.result as string);
        };
        reader.readAsText(file);
        // Reset so the same file can be re-imported
        (e.target as HTMLInputElement).value = '';
      },
    );

    document.getElementById('btn-clear')!.addEventListener('click', () => {
      this.callbacks.onClearAll();
    });

    document.getElementById('btn-apply-grid')!.addEventListener('click', () => {
      const w = parseInt((document.getElementById('grid-width') as HTMLInputElement).value, 10);
      const d = parseInt((document.getElementById('grid-depth') as HTMLInputElement).value, 10);
      if (w > 0 && d > 0) this.callbacks.onGridResize(w, d);
    });

    this.collisionBtn.addEventListener('click', () => {
      this.callbacks.onToggleCollisionMode();
    });

    this.spawnBtn.addEventListener('click', () => {
      this.callbacks.onToggleSpawnMode();
    });

    this.rampBtn.addEventListener('click', () => {
      this.callbacks.onToggleRampMode();
    });
  }

  setCollisionModeActive(active: boolean): void {
    if (active) {
      this.collisionBtn.style.background = '#e94560';
      this.collisionBtn.style.color = '#fff';
    } else {
      this.collisionBtn.style.background = '';
      this.collisionBtn.style.color = '';
    }
  }

  setSpawnModeActive(active: boolean): void {
    if (active) {
      this.spawnBtn.style.background = '#9b59b6';
      this.spawnBtn.style.color = '#fff';
    } else {
      this.spawnBtn.style.background = '';
      this.spawnBtn.style.color = '';
    }
  }

  setRampModeActive(active: boolean): void {
    if (active) {
      this.rampBtn.style.background = '#00ff88';
      this.rampBtn.style.color = '#000';
    } else {
      this.rampBtn.style.background = '';
      this.rampBtn.style.color = '';
    }
  }

  updateInfo(
    selectedModel: string | null,
    placementCount: number,
    rotation?: { x: number; y: number; z: number },
    collisionMode = false,
    colliderCount = 0,
    spawnMode = false,
    spawnRole = '',
    rampMode = false,
    rampCount = 0,
  ): void {
    const toDeg = (rad: number) => Math.round((rad * 180) / Math.PI) % 360;
    const rotStr = rotation
      ? ` | Rot: X${toDeg(rotation.x)} Y${toDeg(rotation.y)} Z${toDeg(rotation.z)}`
      : '';
    const collStr = ` | Colliders: ${colliderCount}`;
    const rampStr = ` | Ramps: ${rampCount}`;
    if (rampMode) {
      this.infoEl.textContent = `RAMP MODE | Placed: ${placementCount}${collStr}${rampStr}`;
    } else if (spawnMode) {
      this.infoEl.textContent = `SPAWN MODE [${spawnRole}] | Placed: ${placementCount}${collStr}${rampStr}`;
    } else if (collisionMode) {
      this.infoEl.textContent = `COLLISION MODE | Placed: ${placementCount}${collStr}${rampStr}`;
    } else if (selectedModel) {
      this.infoEl.textContent = `Selected: ${selectedModel}${rotStr} | Placed: ${placementCount}${collStr}${rampStr}`;
    } else {
      this.infoEl.textContent = `No model selected | Placed: ${placementCount}${collStr}${rampStr}`;
    }
  }

  clearSelection(): void {
    if (this.selectedBtn) {
      this.selectedBtn.classList.remove('active');
      this.selectedBtn = null;
    }
    this.previewImg.style.display = 'none';
  }
}
