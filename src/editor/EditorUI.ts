import type { ModelCatalog } from './ModelCatalog';

export interface EditorUICallbacks {
  onSelectModel: (name: string) => void;
  onExport: () => void;
  onImport: (json: string) => void;
  onClearAll: () => void;
  onGridResize: (width: number, depth: number) => void;
}

export class EditorUI {
  private selectedBtn: HTMLButtonElement | null = null;
  private previewImg: HTMLImageElement;
  private infoEl: HTMLDivElement;
  private modelListEl: HTMLDivElement;

  constructor(
    private catalog: ModelCatalog,
    private callbacks: EditorUICallbacks,
  ) {
    this.modelListEl = document.getElementById('model-list') as HTMLDivElement;
    this.infoEl = document.getElementById('selected-info') as HTMLDivElement;

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
  }

  updateInfo(
    selectedModel: string | null,
    placementCount: number,
    rotation?: { x: number; y: number; z: number },
  ): void {
    const toDeg = (rad: number) => Math.round((rad * 180) / Math.PI) % 360;
    const rotStr = rotation
      ? ` | Rot: X${toDeg(rotation.x)} Y${toDeg(rotation.y)} Z${toDeg(rotation.z)}`
      : '';
    if (selectedModel) {
      this.infoEl.textContent = `Selected: ${selectedModel}${rotStr} | Placed: ${placementCount}`;
    } else {
      this.infoEl.textContent = `No model selected | Placed: ${placementCount}`;
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
