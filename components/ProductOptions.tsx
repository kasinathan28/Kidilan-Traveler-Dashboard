import React, { useMemo, useState } from 'react';
import { ProductVariant, SizeSet } from '../types';
import { XIcon } from './icons';

// Colours and sizes for one product. Every colour x size combination becomes a variant with its
// own stock and, optionally, its own price. A colour can point at one of the product's photos,
// so the storefront shows that photo when a shopper picks the colour.
// Ready-made size lists come from the admin's size sets (Settings > Size sets), not from code, so a
// new kind of product (rings, bottles by capacity, ...) needs no deployment.

type Cell = { stock: string; price: string };
type Colour = { name: string; image: number | null };

export type OptionsState = { colours: Colour[]; sizes: string[]; cells: Record<string, Cell> };

// the size set linked to this category, if any
export const suggestedSizeSet = (sets: SizeSet[], categoryId?: string) =>
  (categoryId && sets.find((s) => s.categoryIds.includes(categoryId))) || null;

const keyOf = (colour: string, size: string) => `${colour.toLowerCase()}|${size.toLowerCase()}`;

export const optionsFromVariants = (variants: ProductVariant[] = []): OptionsState => {
  const colours: Colour[] = [];
  const sizes: string[] = [];
  const cells: Record<string, Cell> = {};
  for (const v of variants) {
    const c = v.attributes?.color || '';
    const s = v.attributes?.size || '';
    if (c && !colours.some((x) => x.name.toLowerCase() === c.toLowerCase())) colours.push({ name: c, image: v.image ?? null });
    if (s && !sizes.some((x) => x.toLowerCase() === s.toLowerCase())) sizes.push(s);
    cells[keyOf(c, s)] = { stock: String(v.stock ?? 0), price: v.price == null ? '' : String(v.price) };
  }
  return { colours, sizes, cells };
};

// every combination; one list empty means the other alone
export const combinations = (o: OptionsState) => {
  const cs = o.colours.length ? o.colours.map((c) => c.name) : [''];
  const ss = o.sizes.length ? o.sizes : [''];
  if (!o.colours.length && !o.sizes.length) return [];
  return cs.flatMap((c) => ss.map((s) => ({ colour: c, size: s })));
};

export const variantsFromOptions = (o: OptionsState): ProductVariant[] =>
  combinations(o).map(({ colour, size }) => {
    const cell = o.cells[keyOf(colour, size)] || { stock: '0', price: '' };
    return {
      attributes: { color: colour || undefined, size: size || undefined },
      stock: Number(cell.stock || 0),
      price: cell.price === '' ? null : Number(cell.price),
      image: o.colours.find((c) => c.name === colour)?.image ?? null,
    };
  });

export const optionsError = (o: OptionsState): string | null => {
  for (const { colour, size } of combinations(o)) {
    const cell = o.cells[keyOf(colour, size)];
    const label = [colour, size].filter(Boolean).join(' / ');
    const n = Number(cell?.stock ?? '');
    if (cell?.stock === undefined || cell.stock === '' || !Number.isInteger(n) || n < 0) return `Enter the stock for ${label} (0 or more).`;
    if (cell.price !== '' && (isNaN(Number(cell.price)) || Number(cell.price) < 0)) return `The price for ${label} is not a number.`;
  }
  return null;
};

const chip = 'inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white py-1 pl-3 pr-1 text-sm';
const input = 'p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D7A79] text-sm';

const ProductOptions: React.FC<{
  value: OptionsState;
  onChange: (o: OptionsState) => void;
  imageUrls: string[];
  categoryId?: string;
  categoryName?: string;
  sizeSets: SizeSet[];
  onSaveSizeSet: (name: string, sizes: string[], linkCategory: boolean) => Promise<void>;
  basePrice: string;
  error?: string | null;
}> = ({ value, onChange, imageUrls, categoryId, categoryName, sizeSets, onSaveSizeSet, basePrice, error }) => {
  const [newColour, setNewColour] = useState('');
  const [newSize, setNewSize] = useState('');
  const suggestion = suggestedSizeSet(sizeSets, categoryId);
  // "Save these sizes as a set"
  const [savingSet, setSavingSet] = useState<null | { name: string; link: boolean; busy: boolean; error: string | null }>(null);
  const sameAsSaved = sizeSets.some(
    (s) => s.sizes.length === value.sizes.length && s.sizes.every((x, i) => x.toLowerCase() === value.sizes[i]?.toLowerCase())
  );
  const submitSet = async () => {
    if (!savingSet) return;
    const name = savingSet.name.trim();
    if (!name) return setSavingSet({ ...savingSet, error: 'Give the set a name.' });
    if (sizeSets.some((s) => s.name.toLowerCase() === name.toLowerCase())) return setSavingSet({ ...savingSet, error: 'A set with this name exists.' });
    setSavingSet({ ...savingSet, busy: true, error: null });
    try {
      await onSaveSizeSet(name, value.sizes, savingSet.link);
      setSavingSet(null);
    } catch (e: any) {
      setSavingSet({ ...savingSet, busy: false, error: e?.message || 'Could not save the set.' });
    }
  };
  const combos = useMemo(() => combinations(value), [value]);
  const total = combos.reduce((n, { colour, size }) => n + (Number(value.cells[keyOf(colour, size)]?.stock) || 0), 0);

  const set = (patch: Partial<OptionsState>) => onChange({ ...value, ...patch });
  const addColour = () => {
    const name = newColour.trim();
    if (!name || value.colours.some((c) => c.name.toLowerCase() === name.toLowerCase())) return;
    set({ colours: [...value.colours, { name, image: null }] });
    setNewColour('');
  };
  const addSize = (raw = newSize) => {
    const s = raw.trim();
    if (!s || value.sizes.some((x) => x.toLowerCase() === s.toLowerCase())) return;
    set({ sizes: [...value.sizes, s] });
    setNewSize('');
  };
  const setCell = (colour: string, size: string, patch: Partial<Cell>) => {
    const k = keyOf(colour, size);
    set({ cells: { ...value.cells, [k]: { stock: '', price: '', ...value.cells[k], ...patch } } });
  };

  return (
    <fieldset className="rounded-lg border border-gray-200 p-4">
      <legend className="px-1 text-sm font-semibold text-gray-800">Colours and sizes</legend>
      <p className="mb-4 text-sm text-gray-500">
        Leave both empty when the product comes in one version. With options, each one has its own stock, and the product's stock is their total.
      </p>

      {/* Sizes */}
      <div className="mb-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="size-set" className="text-sm font-medium text-gray-700">Sizes</label>
          <select
            id="size-set"
            className={input}
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (v === '__none') set({ sizes: [] });
              else {
                const s = sizeSets.find((x) => x.id === v);
                if (s) set({ sizes: [...s.sizes] });
              }
            }}
          >
            <option value="">Use a size set…</option>
            {suggestion && <option value={suggestion.id}>{suggestion.name} (suggested for {categoryName || 'this category'})</option>}
            {sizeSets.filter((s) => s.id !== suggestion?.id).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
            <option value="__none">No sizes</option>
          </select>
        </div>
        <p className="mb-2 text-xs text-gray-500">Size sets are managed in Settings › Size sets.</p>
        <div className="flex flex-wrap gap-2">
          {value.sizes.map((s) => (
            <span key={s} className={chip}>
              {s}
              <button type="button" aria-label={`Remove size ${s}`} className="rounded-full p-1 text-gray-500 hover:bg-red-50 hover:text-red-600" onClick={() => set({ sizes: value.sizes.filter((x) => x !== s) })}>
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
          <span className="inline-flex gap-1">
            <input
              aria-label="Add a size"
              className={`${input} w-28`}
              placeholder="Add size"
              value={newSize}
              onChange={(e) => setNewSize(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSize(); } }}
            />
            <button type="button" onClick={() => addSize()} className="rounded-lg bg-gray-100 px-3 text-sm font-medium hover:bg-gray-200">Add</button>
          </span>
        </div>

        {/* keep a new list of sizes for the next product of this kind */}
        {value.sizes.length > 0 && !sameAsSaved && !savingSet && (
          <button
            type="button"
            onClick={() => setSavingSet({ name: '', link: !!categoryId, busy: false, error: null })}
            className="mt-2 text-sm font-semibold text-[#2D7A79] hover:underline"
          >
            Save these sizes as a size set
          </button>
        )}
        {savingSet && (
          <div className="mt-3 rounded-lg bg-gray-50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                aria-label="Size set name"
                autoFocus
                className={`${input} w-56`}
                placeholder="e.g. Rings (6 to 12)"
                value={savingSet.name}
                onChange={(e) => setSavingSet({ ...savingSet, name: e.target.value, error: null })}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitSet(); } }}
              />
              <button type="button" disabled={savingSet.busy} onClick={submitSet} className="rounded-lg bg-[#2D7A79] px-3 py-2 text-sm font-semibold text-white hover:bg-opacity-90 disabled:opacity-60">
                {savingSet.busy ? 'Saving…' : 'Save set'}
              </button>
              <button type="button" onClick={() => setSavingSet(null)} className="px-2 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
            </div>
            {categoryId && (
              <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" className="h-4 w-4 accent-[#2D7A79]" checked={savingSet.link} onChange={(e) => setSavingSet({ ...savingSet, link: e.target.checked })} />
                Suggest it for {categoryName || 'this category'}
              </label>
            )}
            {savingSet.error && <p className="mt-1 text-sm text-red-600">{savingSet.error}</p>}
          </div>
        )}
      </div>

      {/* Colours */}
      <div className="mb-5">
        <label htmlFor="new-colour" className="mb-2 block text-sm font-medium text-gray-700">Colours</label>
        <ul className="mb-2 space-y-2">
          {value.colours.map((c, i) => (
            <li key={c.name} className="flex flex-wrap items-center gap-2">
              <span className="inline-block h-4 w-4 rounded-full border border-gray-300" style={{ background: c.name.toLowerCase().replace(/\s+/g, '') }} aria-hidden="true" />
              <span className="min-w-[6rem] text-sm font-medium">{c.name}</span>
              <label className="text-sm text-gray-500" htmlFor={`colour-photo-${i}`}>Photo</label>
              <select
                id={`colour-photo-${i}`}
                className={input}
                value={c.image ?? ''}
                onChange={(e) =>
                  set({ colours: value.colours.map((x, j) => (j === i ? { ...x, image: e.target.value === '' ? null : Number(e.target.value) } : x)) })
                }
              >
                <option value="">First photo</option>
                {imageUrls.map((_, n) => (
                  <option key={n} value={n}>Photo {n + 1}</option>
                ))}
              </select>
              {c.image != null && imageUrls[c.image] && (
                <img src={imageUrls[c.image]} alt="" className="h-9 w-9 rounded border object-cover" />
              )}
              <button type="button" aria-label={`Remove colour ${c.name}`} className="ml-auto rounded-full p-1 text-gray-500 hover:bg-red-50 hover:text-red-600" onClick={() => set({ colours: value.colours.filter((_, j) => j !== i) })}>
                <XIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        <span className="inline-flex gap-1">
          <input
            id="new-colour"
            className={`${input} w-44`}
            placeholder="e.g. Black, Navy, Olive"
            value={newColour}
            onChange={(e) => setNewColour(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addColour(); } }}
          />
          <button type="button" onClick={addColour} className="rounded-lg bg-gray-100 px-3 text-sm font-medium hover:bg-gray-200">Add colour</button>
        </span>
      </div>

      {/* Stock and price per combination */}
      {combos.length > 0 && (
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-sm font-medium text-gray-700">Stock and price for each option</span>
            <span className="text-sm text-gray-500">Total stock: <strong className="text-gray-800">{total}</strong></span>
          </div>
          <div className="max-h-72 overflow-y-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Option</th>
                  <th className="px-3 py-2 font-medium">Stock</th>
                  <th className="px-3 py-2 font-medium">Price (optional)</th>
                </tr>
              </thead>
              <tbody>
                {combos.map(({ colour, size }) => {
                  const k = keyOf(colour, size);
                  const label = [colour, size].filter(Boolean).join(' / ');
                  const cell = value.cells[k] || { stock: '', price: '' };
                  return (
                    <tr key={k} className="border-t">
                      <td className="px-3 py-2 font-medium text-gray-800">{label}</td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" step="1" aria-label={`Stock for ${label}`} className={`${input} w-24`} value={cell.stock} onChange={(e) => setCell(colour, size, { stock: e.target.value })} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" step="0.01" aria-label={`Price for ${label}`} className={`${input} w-28`} placeholder={basePrice || 'Same'} value={cell.price} onChange={(e) => setCell(colour, size, { price: e.target.value })} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-gray-500">Leave the price empty to use the product price. The product's discount applies to every option.</p>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </fieldset>
  );
};

export default ProductOptions;
