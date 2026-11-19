import React, { useEffect, useState } from 'react';
import { Category, SizeSet } from '../types';
import { getSizeSets, saveSizeSets, getCategories } from '../api/mockApi';
import LoadingSpinner from './LoadingSpinner';
import { XIcon, DeleteIcon } from './icons';

// Settings > Size sets: the ready-made size lists the product form offers, and the categories each
// one is suggested for. A new kind of product (rings, bottles by capacity, kids' ages) is a new set
// here: no code change, no deployment.

type Draft = SizeSet & { newSize: string };

const input = 'p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2D7A79] focus:outline-none text-sm';

const SizeSetsSection: React.FC<{ showToast: (msg: string) => void }> = ({ showToast }) => {
  const [sets, setSets] = useState<Draft[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openCats, setOpenCats] = useState<string | null>(null); // set whose category list is open

  const load = async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([getSizeSets(), getCategories()]);
      setSets(s.map((x) => ({ ...x, newSize: '' })));
      setCategories(c);
      setDirty(false);
    } catch (e: any) {
      setError(e?.message || 'Could not load the size sets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const update = (i: number, patch: Partial<Draft>) => {
    setSets((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
    setDirty(true);
    setError(null);
  };

  const addSize = (i: number) => {
    const s = sets[i];
    const size = s.newSize.trim();
    if (!size || s.sizes.some((x) => x.toLowerCase() === size.toLowerCase())) return update(i, { newSize: '' });
    update(i, { sizes: [...s.sizes, size], newSize: '' });
  };

  const moveSize = (i: number, k: number, dir: -1 | 1) => {
    const sizes = [...sets[i].sizes];
    const t = k + dir;
    if (t < 0 || t >= sizes.length) return;
    [sizes[k], sizes[t]] = [sizes[t], sizes[k]];
    update(i, { sizes });
  };

  const toggleCat = (i: number, id: string) => {
    const ids = sets[i].categoryIds;
    update(i, { categoryIds: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] });
  };

  const addSet = () => {
    setSets((prev) => [...prev, { id: '', name: '', sizes: [], categoryIds: [], newSize: '' }]);
    setDirty(true);
  };

  const save = async () => {
    for (const s of sets) {
      if (!s.name.trim()) return setError('Every size set needs a name.');
      if (!s.sizes.length) return setError(`"${s.name}" has no sizes yet.`);
    }
    setSaving(true);
    try {
      const saved = await saveSizeSets(sets.map(({ newSize, ...s }) => s));
      setSets(saved.map((x) => ({ ...x, newSize: '' })));
      setDirty(false);
      showToast('Size sets saved.');
    } catch (e: any) {
      setError(e?.message || 'Could not save the size sets.');
    } finally {
      setSaving(false);
    }
  };

  const catName = (id: string) => categories.find((c) => c._id === id)?.name;
  // a category linked to two sets gets the first one suggested; say so
  const linkedTo = (id: string, except: number) => sets.findIndex((s, j) => j !== except && s.categoryIds.includes(id));

  return (
    <div className="bg-white p-6 rounded-xl shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
        <div>
          <h3 className="text-xl font-bold text-gray-800">Size sets</h3>
          <p className="text-gray-500 text-sm mt-1 max-w-2xl">
            Ready-made size lists for the product form's "Colours and sizes". Link a set to categories and it is suggested for their
            products. Add a set for any new kind of product, for example rings (6 to 12) or bottles (500 ml, 750 ml, 1 L).
          </p>
        </div>
        <button type="button" onClick={addSet} className="shrink-0 px-4 py-2 rounded-lg bg-gray-100 text-sm font-semibold text-gray-800 hover:bg-gray-200">
          + Add size set
        </button>
      </div>

      {loading ? (
        <div className="py-10 flex justify-center"><LoadingSpinner /></div>
      ) : (
        <>
          <ul className="mt-5 space-y-4">
            {sets.map((s, i) => (
              <li key={s.id || `new-${i}`} className="rounded-lg border border-gray-200 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    aria-label="Size set name"
                    className={`${input} w-64 font-medium`}
                    placeholder="Name, e.g. Rings (6 to 12)"
                    value={s.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => { setSets((prev) => prev.filter((_, j) => j !== i)); setDirty(true); }}
                    className="ml-auto p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50"
                    aria-label={`Delete size set ${s.name}`}
                  >
                    <DeleteIcon className="w-5 h-5" />
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {s.sizes.map((z, k) => (
                    <span key={z} className="inline-flex items-center gap-0.5 rounded-full border border-gray-300 bg-white py-1 pl-3 pr-1 text-sm">
                      <button type="button" className="px-1 text-gray-400 hover:text-gray-700 disabled:opacity-30" disabled={k === 0} onClick={() => moveSize(i, k, -1)} aria-label={`Move ${z} left`}>‹</button>
                      {z}
                      <button type="button" className="px-1 text-gray-400 hover:text-gray-700 disabled:opacity-30" disabled={k === s.sizes.length - 1} onClick={() => moveSize(i, k, 1)} aria-label={`Move ${z} right`}>›</button>
                      <button type="button" className="rounded-full p-1 text-gray-500 hover:bg-red-50 hover:text-red-600" onClick={() => update(i, { sizes: s.sizes.filter((x) => x !== z) })} aria-label={`Remove size ${z}`}>
                        <XIcon className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                  <span className="inline-flex gap-1">
                    <input
                      aria-label={`Add a size to ${s.name || 'this set'}`}
                      className={`${input} w-28`}
                      placeholder="Add size"
                      value={s.newSize}
                      onChange={(e) => update(i, { newSize: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSize(i); } }}
                    />
                    <button type="button" onClick={() => addSize(i)} className="rounded-lg bg-gray-100 px-3 text-sm font-medium hover:bg-gray-200">Add</button>
                  </span>
                </div>

                <div className="mt-3 text-sm">
                  <span className="text-gray-600">Suggested for: </span>
                  {s.categoryIds.length ? (
                    s.categoryIds.map((id) => <span key={id} className="mr-1.5 inline-block rounded-full bg-[#2D7A79]/10 px-2.5 py-0.5 text-[#2D7A79]">{catName(id) || 'Deleted category'}</span>)
                  ) : (
                    <span className="text-gray-400">no categories</span>
                  )}
                  <button type="button" onClick={() => setOpenCats(openCats === `${i}` ? null : `${i}`)} className="ml-1 font-semibold text-[#2D7A79] hover:underline">
                    {openCats === `${i}` ? 'Done' : 'Choose'}
                  </button>
                  {openCats === `${i}` && (
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 rounded-lg bg-gray-50 p-3">
                      {categories.map((c) => {
                        const other = linkedTo(c._id, i);
                        return (
                          <label key={c._id} className="flex items-center gap-2 text-gray-700">
                            <input type="checkbox" className="h-4 w-4 accent-[#2D7A79]" checked={s.categoryIds.includes(c._id)} onChange={() => toggleCat(i, c._id)} />
                            <span>{c.name}</span>
                            {other >= 0 && <span className="text-xs text-gray-400">(also {sets[other].name || 'another set'})</span>}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </li>
            ))}
            {sets.length === 0 && <li className="py-6 text-center text-gray-500">No size sets yet.</li>}
          </ul>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="mt-5 flex justify-end gap-3">
            {dirty && (
              <button type="button" onClick={load} disabled={saving} className="px-5 py-2 rounded-lg text-gray-700 bg-gray-200 hover:bg-gray-300 font-semibold">
                Discard changes
              </button>
            )}
            <button type="button" onClick={save} disabled={!dirty || saving} className="px-6 py-2 rounded-lg text-white font-semibold bg-[#2D7A79] hover:bg-opacity-90 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save size sets'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default SizeSetsSection;
