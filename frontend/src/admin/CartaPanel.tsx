import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adminApi, type CategoriaAdmin, type PlatoAdmin } from "@dcuerdas/shared";
import { MenuIcon } from "./AdminIcons";

type Props = { readonly accessToken: string };

const NOMBRE_MAX = 80;
const DESCRIPCION_MAX = 180;
const PRECIO_MAX = 999.99;
const GUARDADO_COOLDOWN_MS = 1200;
const CAT_NUEVA = "__nueva__";

type FormPlato = {
  nombre: string;
  precio: string;
  descripcion: string;
  disponible: boolean;
  categoria_id: string;
};

function limpiarPrecio(value: string): string | null {
  const limpio = value.replace(",", ".").replace(/[^\d.]/g, "");
  const partes = limpio.split(".");
  const entero = partes[0].slice(0, 3);
  const decimal = partes.slice(1).join("").slice(0, 2);
  const resultado = partes.length > 1 ? `${entero}.${decimal}` : entero;
  return Number(resultado || 0) <= PRECIO_MAX ? resultado : null;
}

function validarPlato(nombre: string, precioRaw: string, categoriaOk: boolean): string | null {
  const precio = Number(precioRaw);
  if (!categoriaOk) return "Selecciona o crea una categoría.";
  if (nombre.trim().length < 2) return "El nombre debe tener al menos 2 caracteres.";
  if (nombre.trim().length > NOMBRE_MAX) return `Máximo ${NOMBRE_MAX} caracteres en el nombre.`;
  if (!Number.isFinite(precio) || precio <= 0 || precio > PRECIO_MAX) {
    return "El precio debe estar entre S/ 0.01 y S/ 999.99.";
  }
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(precioRaw)) {
    return "Usa hasta 3 cifras y 2 decimales (ej. 24.90).";
  }
  return null;
}

export function CartaPanel({ accessToken }: Props) {
  const [platos, setPlatos] = useState<PlatoAdmin[]>([]);
  const [categorias, setCategorias] = useState<CategoriaAdmin[]>([]);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [draft, setDraft] = useState<FormPlato>({
    nombre: "",
    precio: "",
    descripcion: "",
    disponible: true,
    categoria_id: "",
  });
  const [eliminandoId, setEliminandoId] = useState<number | null>(null);
  const [eliminandoCatId, setEliminandoCatId] = useState<number | null>(null);
  const [nuevo, setNuevo] = useState({
    categoria_id: "",
    nueva_categoria: "",
    nombre: "",
    precio: "",
    descripcion: "",
  });
  const [catNueva, setCatNueva] = useState({ nombre: "", descripcion: "" });
  const [editCatId, setEditCatId] = useState<number | null>(null);
  const [draftCat, setDraftCat] = useState({ nombre: "", descripcion: "", activa: true });
  const [creando, setCreando] = useState(false);
  const [creandoCat, setCreandoCat] = useState(false);
  const [guardandoEdit, setGuardandoEdit] = useState(false);
  const [guardandoCat, setGuardandoCat] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("todas");
  const [catsAbiertas, setCatsAbiertas] = useState(false);
  const ultimaAccionRef = useRef(0);

  const cargar = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([
        adminApi.platos(accessToken),
        adminApi.categorias(accessToken),
      ]);
      setPlatos(p);
      setCategorias(c);
      setError("");
    } catch {
      setError("No se pudo cargar la carta");
    }
  }, [accessToken]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (!ok) return;
    const t = window.setTimeout(() => setOk(""), 2500);
    return () => window.clearTimeout(t);
  }, [ok]);

  const empezarEdicion = (p: PlatoAdmin) => {
    setEditId(p.id);
    setDraft({
      nombre: p.nombre,
      precio: String(p.precio),
      descripcion: p.descripcion ?? "",
      disponible: p.disponible,
      categoria_id: String(p.categoria_id),
    });
    setOk("");
    setError("");
    window.requestAnimationFrame(() => {
      document.getElementById("carta-edit-panel")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  const puedeMutar = () => {
    const ahora = Date.now();
    if (ahora - ultimaAccionRef.current < GUARDADO_COOLDOWN_MS) {
      setError("Espera un momento antes de volver a guardar.");
      return false;
    }
    ultimaAccionRef.current = ahora;
    return true;
  };

  const guardar = async () => {
    if (editId == null) return;
    const mensaje = validarPlato(draft.nombre, draft.precio, true);
    if (mensaje) {
      setError(mensaje);
      return;
    }
    if (!puedeMutar()) return;
    const precio = Number(draft.precio);
    setGuardandoEdit(true);
    setError("");
    try {
      await adminApi.actualizarPlato(accessToken, {
        id: editId,
        nombre: draft.nombre.trim(),
        precio,
        descripcion: draft.descripcion.trim() || null,
        disponible: draft.disponible,
        categoria_id: Number(draft.categoria_id) || undefined,
      });
      setEditId(null);
      setOk("Plato actualizado");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardandoEdit(false);
    }
  };

  const resolverCategoriaId = async (): Promise<number | null> => {
    if (nuevo.categoria_id === CAT_NUEVA) {
      const nombre = nuevo.nueva_categoria.trim();
      if (nombre.length < 2) {
        setError("Escribe el nombre de la nueva categoría.");
        return null;
      }
      const creada = await adminApi.crearCategoria(accessToken, {
        nombre,
        descripcion: null,
        orden: categorias.length + 1,
        activa: true,
      });
      return creada.id;
    }
    const id = Number(nuevo.categoria_id);
    if (!Number.isInteger(id) || id <= 0) return null;
    return id;
  };

  const crear = async () => {
    const categoriaOk =
      (nuevo.categoria_id === CAT_NUEVA && nuevo.nueva_categoria.trim().length >= 2) ||
      (Number(nuevo.categoria_id) > 0);
    const mensaje = validarPlato(nuevo.nombre, nuevo.precio, categoriaOk);
    if (mensaje) {
      setError(mensaje);
      return;
    }
    if (nuevo.descripcion.trim().length > DESCRIPCION_MAX) {
      setError(`Máximo ${DESCRIPCION_MAX} caracteres en la descripción.`);
      return;
    }
    if (!puedeMutar()) return;
    setCreando(true);
    setError("");
    try {
      const categoria_id = await resolverCategoriaId();
      if (categoria_id == null) {
        setError("Selecciona o crea una categoría.");
        return;
      }
      await adminApi.crearPlato(accessToken, {
        categoria_id,
        nombre: nuevo.nombre.trim(),
        precio: Number(nuevo.precio),
        descripcion: nuevo.descripcion.trim() || null,
        disponible: true,
      });
      setNuevo({
        categoria_id: String(categoria_id),
        nueva_categoria: "",
        nombre: "",
        precio: "",
        descripcion: "",
      });
      setOk("Plato creado");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear");
    } finally {
      setCreando(false);
    }
  };

  const crearCategoria = async () => {
    const nombre = catNueva.nombre.trim();
    if (nombre.length < 2) {
      setError("El nombre de categoría debe tener al menos 2 caracteres.");
      return;
    }
    if (!puedeMutar()) return;
    setCreandoCat(true);
    setError("");
    try {
      const creada = await adminApi.crearCategoria(accessToken, {
        nombre,
        descripcion: catNueva.descripcion.trim() || null,
        orden: categorias.length + 1,
        activa: true,
      });
      setCatNueva({ nombre: "", descripcion: "" });
      setNuevo((n) => ({ ...n, categoria_id: String(creada.id), nueva_categoria: "" }));
      setOk("Categoría creada");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la categoría");
    } finally {
      setCreandoCat(false);
    }
  };

  const empezarEdicionCat = (c: CategoriaAdmin) => {
    setEditCatId(c.id);
    setDraftCat({
      nombre: c.nombre,
      descripcion: c.descripcion ?? "",
      activa: c.activa,
    });
    setError("");
    setOk("");
  };

  const guardarCategoria = async () => {
    if (editCatId == null) return;
    if (draftCat.nombre.trim().length < 2) {
      setError("El nombre de categoría debe tener al menos 2 caracteres.");
      return;
    }
    if (!puedeMutar()) return;
    setGuardandoCat(true);
    setError("");
    try {
      await adminApi.actualizarCategoria(accessToken, {
        id: editCatId,
        nombre: draftCat.nombre.trim(),
        descripcion: draftCat.descripcion.trim() || null,
        activa: draftCat.activa,
      });
      setEditCatId(null);
      setOk("Categoría actualizada");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la categoría");
    } finally {
      setGuardandoCat(false);
    }
  };

  const eliminarCategoria = async (c: CategoriaAdmin) => {
    if (!window.confirm(`¿Eliminar la categoría "${c.nombre}"?\nSi tiene platos pedidos en historial, se ocultarán.`)) {
      return;
    }
    if (!puedeMutar()) return;
    setEliminandoCatId(c.id);
    setError("");
    try {
      const res = await adminApi.eliminarCategoria(accessToken, c.id);
      setOk(res.mensaje ?? (res.soft ? "Categoría desactivada" : "Categoría eliminada"));
      if (editCatId === c.id) setEditCatId(null);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar la categoría");
    } finally {
      setEliminandoCatId(null);
    }
  };

  const eliminarPlato = async (p: PlatoAdmin) => {
    if (!window.confirm(`¿Eliminar el plato "${p.nombre}"?\nSi ya salió en pedidos, solo se ocultará.`)) {
      return;
    }
    if (!puedeMutar()) return;
    setEliminandoId(p.id);
    setError("");
    try {
      const res = await adminApi.eliminarPlato(accessToken, p.id);
      setOk(res.mensaje ?? (res.soft ? "Plato ocultado" : "Plato eliminado"));
      if (editId === p.id) setEditId(null);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar el plato");
    } finally {
      setEliminandoId(null);
    }
  };

  const catNombre = (id: number) => categorias.find((c) => c.id === id)?.nombre ?? `Cat ${id}`;

  const platosFiltrados = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    return platos.filter((p) => {
      const coincideCategoria =
        categoriaFiltro === "todas" || String(p.categoria_id) === categoriaFiltro;
      const coincideTexto =
        !q ||
        p.nombre.toLowerCase().includes(q) ||
        (p.descripcion ?? "").toLowerCase().includes(q);
      return coincideCategoria && coincideTexto;
    });
  }, [platos, filtro, categoriaFiltro]);

  const disponibles = platos.filter((p) => p.disponible).length;

  const cambiarPrecio = (
    value: string,
    setter: (updater: (actual: typeof nuevo) => typeof nuevo) => void,
  ) => {
    const limpio = limpiarPrecio(value);
    if (limpio !== null) setter((actual) => ({ ...actual, precio: limpio }));
  };

  return (
    <div className="admin-panel carta-admin">
      <header className="admin-panel-head carta-admin-head">
        <div>
          <span className="carta-admin-eyebrow">Gestión del menú</span>
          <h1><MenuIcon size={26} /> Carta</h1>
        </div>
        <div className="carta-admin-stats" aria-label="Resumen de carta">
          <div><strong>{categorias.length}</strong><span>Categorías</span></div>
          <div><strong>{platos.length}</strong><span>Platos</span></div>
          <div><strong>{disponibles}</strong><span>Disponibles</span></div>
        </div>
      </header>

      {error && <div className="error-msg">{error}</div>}
      {ok && <div className="carta-admin-success">{ok}</div>}

      <section className="admin-card carta-create-card">
        <div className="carta-section-head">
          <div>
            <span className="carta-section-kicker">Agregar</span>
            <h2>Nuevo plato</h2>
          </div>
          <span className="carta-section-note">Elige categoría o crea una nueva al vuelo</span>
        </div>
        <div className="carta-form-grid">
          <label className="carta-field">
            <span>Categoría</span>
            <select
              value={nuevo.categoria_id}
              onChange={(e) => setNuevo((n) => ({ ...n, categoria_id: e.target.value }))}
            >
              <option value="">Seleccionar…</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
              <option value={CAT_NUEVA}>+ Crear nueva categoría…</option>
            </select>
          </label>
          {nuevo.categoria_id === CAT_NUEVA && (
            <label className="carta-field carta-field--wide">
              <span>Nombre de la nueva categoría</span>
              <input
                placeholder="Ej. Especiales del día"
                value={nuevo.nueva_categoria}
                maxLength={NOMBRE_MAX}
                onChange={(e) => setNuevo((n) => ({ ...n, nueva_categoria: e.target.value }))}
              />
            </label>
          )}
          <label className="carta-field carta-field--wide">
            <span>Nombre <small>{nuevo.nombre.length}/{NOMBRE_MAX}</small></span>
            <input
              placeholder="Ej. Lomo saltado"
              value={nuevo.nombre}
              maxLength={NOMBRE_MAX}
              autoComplete="off"
              onChange={(e) => setNuevo((n) => ({ ...n, nombre: e.target.value }))}
            />
          </label>
          <label className="carta-field carta-field--price">
            <span>Precio</span>
            <div className="carta-price-input">
              <b>S/</b>
              <input
                aria-label="Precio en soles"
                placeholder="0.00"
                inputMode="decimal"
                value={nuevo.precio}
                maxLength={6}
                onChange={(e) => cambiarPrecio(e.target.value, setNuevo)}
              />
            </div>
          </label>
          <label className="carta-field carta-field--description">
            <span>Descripción <small>{nuevo.descripcion.length}/{DESCRIPCION_MAX}</small></span>
            <input
              placeholder="Ingredientes o presentación (opcional)"
              value={nuevo.descripcion}
              maxLength={DESCRIPCION_MAX}
              autoComplete="off"
              onChange={(e) => setNuevo((n) => ({ ...n, descripcion: e.target.value }))}
            />
          </label>
          <button type="button" className="btn-primary carta-add-btn" disabled={creando} onClick={() => void crear()}>
            {creando ? "Guardando…" : "+ Agregar plato"}
          </button>
        </div>
      </section>

      <section className="admin-card carta-cats-card">
        <div className="carta-section-head">
          <div>
            <span className="carta-section-kicker">Categorías</span>
            <h2>{categorias.length} categorías</h2>
          </div>
          <button
            type="button"
            className="btn-secondary carta-cats-toggle"
            onClick={() => setCatsAbiertas((v) => !v)}
          >
            {catsAbiertas ? "Ocultar" : "Gestionar categorías"}
          </button>
        </div>

        {catsAbiertas && (
          <>
            <div className="carta-form-grid carta-cats-create">
              <label className="carta-field carta-field--wide">
                <span>Nueva categoría</span>
                <input
                  placeholder="Ej. Entradas"
                  value={catNueva.nombre}
                  maxLength={NOMBRE_MAX}
                  onChange={(e) => setCatNueva((c) => ({ ...c, nombre: e.target.value }))}
                />
              </label>
              <label className="carta-field carta-field--description">
                <span>Descripción (opcional)</span>
                <input
                  placeholder="Texto corto"
                  value={catNueva.descripcion}
                  maxLength={DESCRIPCION_MAX}
                  onChange={(e) => setCatNueva((c) => ({ ...c, descripcion: e.target.value }))}
                />
              </label>
              <button
                type="button"
                className="btn-secondary carta-add-btn"
                disabled={creandoCat}
                onClick={() => void crearCategoria()}
              >
                {creandoCat ? "Guardando…" : "+ Agregar categoría"}
              </button>
            </div>

            <div className="carta-cats-list">
              {categorias.map((c) => (
                <div key={c.id} className={`carta-cat-row ${c.activa ? "" : "is-hidden"}`}>
                  {editCatId === c.id ? (
                    <div className="carta-edit-form">
                      <input
                        value={draftCat.nombre}
                        maxLength={NOMBRE_MAX}
                        onChange={(e) => setDraftCat((d) => ({ ...d, nombre: e.target.value }))}
                      />
                      <input
                        value={draftCat.descripcion}
                        maxLength={DESCRIPCION_MAX}
                        placeholder="Descripción"
                        onChange={(e) => setDraftCat((d) => ({ ...d, descripcion: e.target.value }))}
                      />
                      <label className="carta-switch">
                        <input
                          type="checkbox"
                          checked={draftCat.activa}
                          onChange={(e) => setDraftCat((d) => ({ ...d, activa: e.target.checked }))}
                        />
                        <span className="carta-switch-track" aria-hidden="true" />
                        <em>Activa</em>
                      </label>
                      <div className="carta-edit-actions">
                        <button type="button" className="btn-primary" disabled={guardandoCat} onClick={() => void guardarCategoria()}>
                          {guardandoCat ? "Guardando…" : "Guardar"}
                        </button>
                        <button type="button" className="btn-secondary" onClick={() => setEditCatId(null)}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="carta-cat-main">
                        <strong>{c.nombre}</strong>
                        <span className={`carta-status ${c.activa ? "is-on" : ""}`}>
                          {c.activa ? "Activa" : "Oculta"}
                        </span>
                      </div>
                      <div className="carta-row-actions">
                        <button type="button" className="btn-text" onClick={() => empezarEdicionCat(c)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn-text carta-btn-danger"
                          disabled={eliminandoCatId === c.id}
                          onClick={() => void eliminarCategoria(c)}
                        >
                          {eliminandoCatId === c.id ? "…" : "Eliminar"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="admin-card carta-list-card">
        <div className="carta-toolbar">
          <div>
            <span className="carta-section-kicker">Catálogo</span>
            <h2>Platos ({platosFiltrados.length})</h2>
          </div>
          <div className="carta-toolbar-fields">
            <input
              type="search"
              placeholder="Buscar plato…"
              value={filtro}
              maxLength={NOMBRE_MAX}
              onChange={(e) => setFiltro(e.target.value)}
            />
            <select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)}>
              <option value="todas">Todas las categorías</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        {editId != null && (
          <div className="carta-edit-panel" id="carta-edit-panel">
            <div className="carta-section-head">
              <div>
                <span className="carta-section-kicker">Edición</span>
                <h2>Editando plato</h2>
              </div>
              <button
                type="button"
                className="btn-secondary carta-cats-toggle"
                disabled={guardandoEdit}
                onClick={() => setEditId(null)}
              >
                Cerrar
              </button>
            </div>
            <div className="carta-form-grid carta-edit-panel-grid">
              <label className="carta-field">
                <span>Categoría</span>
                <select
                  value={draft.categoria_id}
                  onChange={(e) => setDraft((d) => ({ ...d, categoria_id: e.target.value }))}
                >
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </label>
              <label className="carta-field carta-field--wide">
                <span>Nombre <small>{draft.nombre.length}/{NOMBRE_MAX}</small></span>
                <input
                  value={draft.nombre}
                  maxLength={NOMBRE_MAX}
                  autoComplete="off"
                  onChange={(e) => setDraft((d) => ({ ...d, nombre: e.target.value }))}
                />
              </label>
              <label className="carta-field carta-field--price">
                <span>Precio</span>
                <div className="carta-price-input">
                  <b>S/</b>
                  <input
                    aria-label="Precio en soles"
                    value={draft.precio}
                    inputMode="decimal"
                    maxLength={6}
                    onChange={(e) => {
                      const limpio = limpiarPrecio(e.target.value);
                      if (limpio !== null) setDraft((d) => ({ ...d, precio: limpio }));
                    }}
                  />
                </div>
              </label>
              <label className="carta-field carta-field--description">
                <span>Descripción <small>{draft.descripcion.length}/{DESCRIPCION_MAX}</small></span>
                <input
                  value={draft.descripcion}
                  placeholder="Descripción"
                  maxLength={DESCRIPCION_MAX}
                  onChange={(e) => setDraft((d) => ({ ...d, descripcion: e.target.value }))}
                />
              </label>
              <label className="carta-switch carta-field--wide">
                <input
                  type="checkbox"
                  checked={draft.disponible}
                  onChange={(e) => setDraft((d) => ({ ...d, disponible: e.target.checked }))}
                />
                <span className="carta-switch-track" aria-hidden="true" />
                <em>Disponible para clientes</em>
              </label>
              <div className="carta-edit-actions carta-field--wide">
                <button type="button" className="btn-primary" disabled={guardandoEdit} onClick={() => void guardar()}>
                  {guardandoEdit ? "Guardando…" : "Guardar cambios"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={guardandoEdit}
                  onClick={() => setEditId(null)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {platosFiltrados.length === 0 ? (
          <div className="carta-empty">No hay platos que coincidan.</div>
        ) : (
          <div className="carta-platos-grid">
            {platosFiltrados.map((p) => (
              <article
                key={p.id}
                className={`carta-plato-card ${p.disponible ? "" : "is-hidden"} ${editId === p.id ? "is-selected" : ""}`}
              >
                <div className="carta-plato-view">
                  <div className="carta-plato-top">
                    <span className="carta-category-pill">{catNombre(p.categoria_id)}</span>
                    <span className={`carta-status ${p.disponible ? "is-on" : ""}`}>
                      {p.disponible ? "Disponible" : "Oculto"}
                    </span>
                  </div>
                  <h3>{p.nombre}</h3>
                  <p>{p.descripcion || "Sin descripción"}</p>
                  <div className="carta-plato-footer">
                    <strong>S/ {Number(p.precio).toFixed(2)}</strong>
                    <div className="carta-row-actions">
                      <button type="button" className="btn-text" onClick={() => empezarEdicion(p)}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn-text carta-btn-danger"
                        disabled={eliminandoId === p.id}
                        onClick={() => void eliminarPlato(p)}
                      >
                        {eliminandoId === p.id ? "…" : "Eliminar"}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
