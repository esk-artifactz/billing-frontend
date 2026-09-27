import { useState, useEffect, useRef } from 'react';
import { getMenu } from '../api/client';

const B = {
  darkBrown: '#2d1a0e', midBrown: '#4a2c0a', brown: '#3d2008',
  gold: '#d4a017', goldLight: '#f5c842', goldDark: '#b8860b',
  cream: '#fdf6e3', creamMid: '#f5ead0',
  text: '#7a4e08', textLight: '#a07020',
};

const fmt = (n) => parseFloat(n || 0).toFixed(0);

// Same emoji matching style as the POS
const getEmoji = (name) => {
  const h = name.toLowerCase();
  if (h.includes('chai') || h.includes('tea'))                      return '🍵';
  if (h.includes('coffee') || h.includes('cappuccino') || h.includes('latte') || h.includes('espresso') || h.includes('mocha')) return '☕';
  if (h.includes('juice') || h.includes('lemon') || h.includes('orange') || h.includes('mango')) return '🧃';
  if (h.includes('lassi') || h.includes('buttermilk') || h.includes('chaas')) return '🥛';
  if (h.includes('milkshake') || h.includes('shake') || h.includes('smoothie')) return '🥤';
  if (h.includes('soda') || h.includes('cola') || h.includes('pepsi') || h.includes('sprite')) return '🥤';
  if (h.includes('water'))                                          return '💧';
  if (h.includes('sandwich') || h.includes('burger') || h.includes('wrap') || h.includes('roll')) return '🥪';
  if (h.includes('pizza'))                                          return '🍕';
  if (h.includes('pasta') || h.includes('noodle') || h.includes('maggi')) return '🍝';
  if (h.includes('biryani') || h.includes('rice') || h.includes('pulao')) return '🍚';
  if (h.includes('dosa') || h.includes('idli') || h.includes('vada') || h.includes('paratha') || h.includes('roti') || h.includes('naan') || h.includes('bread')) return '🫓';
  if (h.includes('egg') || h.includes('omelette'))                  return '🍳';
  if (h.includes('cake') || h.includes('pastry') || h.includes('brownie') || h.includes('muffin')) return '🍰';
  if (h.includes('cookie') || h.includes('biscuit'))                return '🍪';
  if (h.includes('ice cream') || h.includes('sundae') || h.includes('kulfi')) return '🍦';
  if (h.includes('puff') || h.includes('samosa') || h.includes('kachori')) return '🥐';
  if (h.includes('chocolate') || h.includes('choco'))               return '🍫';
  if (h.includes('sweet') || h.includes('laddu') || h.includes('halwa') || h.includes('jalebi')) return '🍬';
  if (h.includes('salad') || h.includes('veg'))                     return '🥗';
  if (h.includes('soup'))                                           return '🍲';
  if (h.includes('fries') || h.includes('chips') || h.includes('fry')) return '🍟';
  return '☕';
};

export default function Menu() {
  const [products, setProducts]     = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [activeCat, setActiveCat]   = useState('all');
  const [search, setSearch]         = useState('');
  const sectionRefs = useRef({});

  useEffect(() => {
    getMenu()
      .then(res => {
        setCategories(res.data.categories || []);
        setProducts(res.data.products || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Products grouped by category, filtered by search
  const byCat = categories.map(cat => ({
    ...cat,
    items: products.filter(p =>
      p.category_id === cat.id &&
      (!search || p.name.toLowerCase().includes(search.toLowerCase()))
    ),
  })).filter(c => c.items.length > 0);

  const uncategorized = products.filter(p =>
    !p.category_id && (!search || p.name.toLowerCase().includes(search.toLowerCase()))
  );

  const scrollToCat = (id) => {
    setActiveCat(id);
    if (id !== 'all') sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const visibleCats = activeCat === 'all' ? byCat : byCat.filter(c => c.id === activeCat);

  return (
    <div className="min-h-screen" style={{ background: `linear-gradient(160deg,${B.cream} 0%,${B.creamMid} 60%,#ede0c4 100%)` }}>

      {/* Header */}
      <header className="text-center px-6 pt-8 pb-6"
        style={{ background: `linear-gradient(135deg,${B.darkBrown},${B.midBrown},${B.brown})`, borderBottom: `3px solid ${B.gold}` }}>
        <img src="/logo.jpg" alt="Crown Tea Hub"
          className="w-20 h-20 rounded-full object-cover mx-auto border-4 shadow-lg"
          style={{ borderColor: B.gold }} />
        <h1 className="mt-4 text-3xl font-extrabold tracking-widest uppercase"
          style={{ color: B.goldLight, fontFamily: 'Georgia, serif' }}>Crown Tea Hub</h1>
        <p className="text-sm mt-1 tracking-wide" style={{ color: '#c8a84b' }}>Bakery &amp; Café</p>
        <p className="text-xs mt-0.5 italic" style={{ color: '#a8893f' }}>Refresh · Relax · Repeat</p>
        <div className="mt-3 flex items-center justify-center gap-2">
          <div className="h-px w-16" style={{ background: `linear-gradient(90deg,transparent,${B.gold})` }} />
          <span className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: B.gold }}>Menu</span>
          <div className="h-px w-16" style={{ background: `linear-gradient(90deg,${B.gold},transparent)` }} />
        </div>
      </header>

      {/* Search + category chips (sticky) */}
      <div className="sticky top-0 z-10 px-4 py-3 shadow-md"
        style={{ background: `linear-gradient(135deg,${B.darkBrown},${B.midBrown})` }}>
        <input
          type="text" placeholder="Search the menu..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full text-sm rounded-xl px-4 py-2.5 outline-none mb-3"
          style={{ background: 'rgba(255,255,255,0.12)', border: `1.5px solid ${B.gold}`, color: '#fff' }}
        />
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          <button onClick={() => scrollToCat('all')}
            className="flex-shrink-0 text-xs font-bold px-4 py-2 rounded-full uppercase tracking-wider transition-all"
            style={activeCat === 'all'
              ? { background: B.goldLight, color: B.brown }
              : { background: 'rgba(255,255,255,0.1)', color: '#e8d5a3', border: '1px solid rgba(212,160,23,0.4)' }}>
            All
          </button>
          {byCat.map(cat => (
            <button key={cat.id} onClick={() => scrollToCat(cat.id)}
              className="flex-shrink-0 text-xs font-bold px-4 py-2 rounded-full uppercase tracking-wider transition-all whitespace-nowrap"
              style={activeCat === cat.id
                ? { background: B.goldLight, color: B.brown }
                : { background: 'rgba(255,255,255,0.1)', color: '#e8d5a3', border: '1px solid rgba(212,160,23,0.4)' }}>
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Menu content */}
      <main className="max-w-2xl mx-auto px-4 py-6 pb-16">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 rounded-full border-4 animate-spin"
              style={{ borderColor: B.gold, borderTopColor: 'transparent' }} />
          </div>
        ) : byCat.length === 0 && uncategorized.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-3">🍽️</p>
            <p className="text-lg font-semibold" style={{ color: B.textLight }}>
              {search ? `No items matching "${search}"` : 'Menu coming soon!'}
            </p>
          </div>
        ) : (
          <>
            {visibleCats.map(cat => (
              <section key={cat.id} ref={el => sectionRefs.current[cat.id] = el} className="mb-8 scroll-mt-32">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px flex-1" style={{ background: `linear-gradient(90deg,transparent,${B.gold})` }} />
                  <h2 className="text-lg font-extrabold uppercase tracking-widest"
                    style={{ color: B.brown, fontFamily: 'Georgia, serif' }}>{cat.name}</h2>
                  <div className="h-px flex-1" style={{ background: `linear-gradient(90deg,${B.gold},transparent)` }} />
                </div>
                <div className="space-y-1">
                  {cat.items.map(item => (
                    <div key={item.id} className="flex items-center gap-3 rounded-xl px-4 py-3"
                      style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid #eadfbe' }}>
                      <span className="text-2xl flex-shrink-0">{getEmoji(item.name)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: B.brown }}>{item.name}</p>
                        {item.subcategory && (
                          <p className="text-xs" style={{ color: B.textLight }}>{item.subcategory}</p>
                        )}
                      </div>
                      <div className="flex-1 border-b border-dotted mx-1" style={{ borderColor: '#d4c08a' }} />
                      <span className="font-extrabold text-base flex-shrink-0" style={{ color: B.goldDark }}>
                        ₹{fmt(item.selling_price)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {uncategorized.length > 0 && activeCat === 'all' && (
              <section className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px flex-1" style={{ background: `linear-gradient(90deg,transparent,${B.gold})` }} />
                  <h2 className="text-lg font-extrabold uppercase tracking-widest"
                    style={{ color: B.brown, fontFamily: 'Georgia, serif' }}>More</h2>
                  <div className="h-px flex-1" style={{ background: `linear-gradient(90deg,${B.gold},transparent)` }} />
                </div>
                <div className="space-y-1">
                  {uncategorized.map(item => (
                    <div key={item.id} className="flex items-center gap-3 rounded-xl px-4 py-3"
                      style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid #eadfbe' }}>
                      <span className="text-2xl flex-shrink-0">{getEmoji(item.name)}</span>
                      <p className="flex-1 min-w-0 font-semibold text-sm truncate" style={{ color: B.brown }}>{item.name}</p>
                      <div className="flex-1 border-b border-dotted mx-1" style={{ borderColor: '#d4c08a' }} />
                      <span className="font-extrabold text-base flex-shrink-0" style={{ color: B.goldDark }}>
                        ₹{fmt(item.selling_price)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-6" style={{ borderTop: `2px solid ${B.gold}` }}>
        <p className="text-xs" style={{ color: B.textLight }}>Made with love, served with Crown</p>
        <p className="text-xs mt-1" style={{ color: '#b8a06a' }}>Crown Tea Hub · Bakery &amp; Café</p>
      </footer>
    </div>
  );
}
