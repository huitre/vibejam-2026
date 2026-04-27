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
  onOffsetChange: (x: number, z: number) => void;
  onScaleChange: (scale: number) => void;
}

export class EditorUI {
  private selectedBtn: HTMLButtonElement | null = null;
  private previewImg: HTMLImageElement;
  private infoEl: HTMLDivElement;
  private modelListEl: HTMLDivElement;
  private collisionBtn: HTMLButtonElement;
  private spawnBtn: HTMLButtonElement;
  private rampBtn: HTMLButtonElement;
  private propsPanel: HTMLDivElement;
  private propTitle: HTMLDivElement;
  private propOffsetX: HTMLInputElement;
  private propOffsetZ: HTMLInputElement;
  private propScale: HTMLInputElement;
  private updatingProps = false;

  constructor(
    private catalog: ModelCatalog,
    private callbacks: EditorUICallbacks,
  ) {
    this.modelListEl = document.getElementById('model-list') as HTMLDivElement;
    this.infoEl = document.getElementById('selected-info') as HTMLDivElement;
    this.collisionBtn = document.getElementById('btn-collision') as HTMLButtonElement;
    this.spawnBtn = document.getElementById('btn-spawn') as HTMLButtonElement;
    this.rampBtn = document.getElementById('btn-ramp') as HTMLButtonElement;
    this.propsPanel = document.getElementById('properties-panel') as HTMLDivElement;
    this.propTitle = document.getElementById('prop-title') as HTMLDivElement;
    this.propOffsetX = document.getElementById('prop-offset-x') as HTMLInputElement;
    this.propOffsetZ = document.getElementById('prop-offset-z') as HTMLInputElement;
    this.propScale = document.getElementById('prop-scale') as HTMLInputElement;

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

    const onPropInput = () => {
      if (this.updatingProps) return;
      const x = parseFloat(this.propOffsetX.value);
      const z = parseFloat(this.propOffsetZ.value);
      if (!isNaN(x) && !isNaN(z)) {
        this.callbacks.onOffsetChange(x, z);
      }
    };
    this.propOffsetX.addEventListener('input', onPropInput);
    this.propOffsetZ.addEventListener('input', onPropInput);

    this.propScale.addEventListener('input', () => {
      if (this.updatingProps) return;
      const s = parseFloat(this.propScale.value);
      if (!isNaN(s) && s >= 0.1) {
        this.callbacks.onScaleChange(s);
      }
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
    ghostScale?: number,
  ): void {
    const toDeg = (rad: number) => Math.round((rad * 180) / Math.PI) % 360;
    const rotStr = rotation
      ? ` | Rot: X${toDeg(rotation.x)} Y${toDeg(rotation.y)} Z${toDeg(rotation.z)}`
      : '';
    const scaleStr = ghostScale != null && ghostScale !== 1 ? ` | Scale: ${ghostScale.toFixed(1)}` : '';
    const collStr = ` | Colliders: ${colliderCount}`;
    const rampStr = ` | Ramps: ${rampCount}`;
    if (rampMode) {
      this.infoEl.textContent = `RAMP MODE | Placed: ${placementCount}${collStr}${rampStr}`;
    } else if (spawnMode) {
      this.infoEl.textContent = `SPAWN MODE [${spawnRole}] | Placed: ${placementCount}${collStr}${rampStr}`;
    } else if (collisionMode) {
      this.infoEl.textContent = `COLLISION MODE | Placed: ${placementCount}${collStr}${rampStr}`;
    } else if (selectedModel) {
      this.infoEl.textContent = `Selected: ${selectedModel}${rotStr}${scaleStr} | Placed: ${placementCount}${collStr}${rampStr}`;
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

  showProperties(name: string, x: number, z: number, scale: number): void {
    this.propTitle.textContent = name;
    this.updatingProps = true;
    this.propOffsetX.value = String(parseFloat(x.toFixed(4)));
    this.propOffsetZ.value = String(parseFloat(z.toFixed(4)));
    this.propScale.value = String(parseFloat(scale.toFixed(2)));
    this.updatingProps = false;
    this.propsPanel.style.display = '';
  }

  hideProperties(): void {
    this.propsPanel.style.display = 'none';
  }

  updatePropertyPosition(x: number, z: number): void {
    this.updatingProps = true;
    this.propOffsetX.value = String(parseFloat(x.toFixed(4)));
    this.propOffsetZ.value = String(parseFloat(z.toFixed(4)));
    this.updatingProps = false;
  }

  updatePropertyScale(scale: number): void {
    this.updatingProps = true;
    this.propScale.value = String(parseFloat(scale.toFixed(2)));
    this.updatingProps = false;
  }
}
