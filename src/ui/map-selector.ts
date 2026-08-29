import type { MapCatalog, MapCatalogEntry } from '../game/map-catalog';

const KIND_LABEL: Record<MapCatalogEntry['kind'], string> = {
  village: 'Village',
  arena: 'Arène',
  wilderness: 'Exploration',
};

export function installMapSelector(
  catalog: MapCatalog,
  activeEntry: MapCatalogEntry,
): void {
  const root = document.createElement('div');
  root.id = 'map-selector';
  root.className = 'map-selector';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'map-selector__toggle';
  toggle.setAttribute('aria-label', 'Cartes');
  toggle.setAttribute('aria-controls', 'map-selector-panel');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.textContent = 'Cartes';

  const panel = document.createElement('nav');
  panel.id = 'map-selector-panel';
  panel.className = 'map-selector__panel';
  panel.setAttribute('aria-label', 'Choisir une carte');
  panel.hidden = true;

  const eyebrow = document.createElement('span');
  eyebrow.className = 'map-selector__eyebrow';
  eyebrow.textContent = 'Aperçus locaux';
  panel.append(eyebrow);

  const heading = document.createElement('strong');
  heading.className = 'map-selector__heading';
  heading.textContent = 'Atlas des frontières';
  panel.append(heading);

  const list = document.createElement('div');
  list.className = 'map-selector__list';
  for (const entry of catalog.maps) {
    const target = new URL(window.location.href);
    target.searchParams.set('map', entry.id);
    target.hash = '';

    const link = document.createElement('a');
    link.className = 'map-selector__entry';
    link.href = target.href;
    if (entry.id === activeEntry.id) {
      link.classList.add('is-active');
      link.setAttribute('aria-current', 'page');
    }

    const label = document.createElement('span');
    label.className = 'map-selector__label';
    label.textContent = entry.label;
    const kind = document.createElement('span');
    kind.className = 'map-selector__kind';
    kind.textContent = KIND_LABEL[entry.kind];
    link.append(label, kind);
    list.append(link);
  }
  panel.append(list);
  root.append(toggle, panel);
  document.body.append(root);

  const setOpen = (open: boolean) => {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    root.classList.toggle('is-open', open);
  };
  toggle.addEventListener('click', () => setOpen(panel.hidden));
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Escape') setOpen(false);
  });
}
