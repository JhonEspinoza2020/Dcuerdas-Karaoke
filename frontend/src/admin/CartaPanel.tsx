import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adminApi, type PlatoAdmin } from "@dcuerdas/shared";
import { MenuIcon } from "./AdminIcons";

type Props = { readonly accessToken: string };

const NOMBRE_MAX = 80;
const DESCRIPCION_MAX = 180;
const PRECIO_MAX = 999.99;
const GUARDADO_COOLDOWN_MS = 1200;

type FormPlato = {
  nombre: string;
  precio: string;
  descripcion: string;
  disponible: boolean;
};

function limpiarPrecio(value: string): string | null {
  const limpio = value.replace(",", ".").replace(/[^\d.]/g, "");
  const partes = limpio.split(".");
  const entero = partes[0].slice(0, 3);
  const decimal = partes.slice(1).join("").slice(0, 2);
  const resultado = partes.length > 1 ? `${entero}.${decimal}` : entero;
  return Number(resultado || 0) <= PRECIO_MAX ? resultado : null;
}

function validarPlato(nombre: string, precioRaw: string, categoriaId?: number): string | null {
  const precio = Number(precioRaw);
  if (categoriaId !== undefined && (!Number.isInteger(categoriaId) || categoriaId <= 0)) {
    return "Selecciona una categoría.";
  }
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
  const [categorias, setCategorias] = useState<{ id: number; nombre: string }[]>([]);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [draft, setDraft] = useState<FormPlato>({
    nombre: "",
    precio: "",
    descripcion: "",
    disponible: true,
  });
  const [nuevo, setNuevo] = useState({
    categoria_id: "",
    nombre: "",
    precio: "",
    descripcion: "",
  });
  const [creando, setCreando] = useState(false);
  const [guardandoEdit, setGuardandoEdit] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("todas");
  const ultimaAccionRef = useRef(0);

  const cargar = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([
        adminApi.platos(accessToken),
        adminApi.categorias(accessToken),
      ]);
      setPlatos(p);
      setCategorias(c.map((x) => ({ id: x.id, nombre: x.nombre })));
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
    });
    setOk("");
    setError("");
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
    const mensaje = validarPlato(draft.nombre, draft.precio);
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

  const crear = async () => {
    const precio = Number(nuevo.precio);
    const categoria_id = Number(nuevo.categoria_id);
    const mensaje = validarPlato(nuevo.nombre, nuevo.precio, categoria_id);
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
      await adminApi.crearPlato(accessToken, {
        categoria_id,
        nombre: nuevo.nombre.trim(),
        precio,
        descripcion: nuevo.descripcion.trim() || null,
        disponible: true,
      });
      setNuevo({ categoria_id: nuevo.categoria_id, nombre: "", precio: "", descripcion: "" });
      setOk("Plato creado");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear");
    } finally {
      setCreando(false);
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
          <span className="carta-section-note">Los cambios aparecen en las mesas al instante</span>
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
            </select>
          </label>
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
          <button type="button" className="btn-primary carta-add-btn" disabled={creando} onClick={crear}>
            {creando ? "Guardando…" : "+ Agregar plato"}
          </button>
        </div>
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

        {platosFiltrados.length === 0 ? (
          <div className="carta-empty">No hay platos que coincidan.</div>
        ) : (
          <div className="carta-platos-grid">
            {platosFiltrados.map((p) => (
              <article
                key={p.id}
                className={`carta-plato-card ${p.disponible ? "" : "is-hidden"} ${editId === p.id ? "is-editing" : ""}`}
              >
                {editId === p.id ? (
                  <div className="carta-edit-form">
                    <div className="carta-edit-title">Editando plato</div>
                    <label className="carta-field">
                      <span>Nombre <small>{draft.nombre.length}/{NOMBRE_MAX}</small></span>
                      <input
                        value={draft.nombre}
                        maxLength={NOMBRE_MAX}
                        autoComplete="off"
                        onChange={(e) => setDraft((d) => ({ ...d, nombre: e.target.value }))}
                      />
                    </label>
                    <label className="carta-field">
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
                    <label className="carta-field">
                      <span>Descripción <small>{draft.descripcion.length}/{DESCRIPCION_MAX}</small></span>
                      <textarea
                        value={draft.descripcion}
                        placeholder="Descripción"
                        maxLength={DESCRIPCION_MAX}
                        rows={3}
                        onChange={(e) => setDraft((d) => ({ ...d, descripcion: e.target.value }))}
                      />
                    </label>
                    <label className="carta-switch">
                      <input
                        type="checkbox"
                        checked={draft.disponible}
                        onChange={(e) => setDraft((d) => ({ ...d, disponible: e.target.checked }))}
                      />
                      <span className="carta-switch-track" aria-hidden="true" />
                      <em>Disponible para clientes</em>
                    </label>
                    <div className="carta-edit-actions">
                      <button type="button" className="btn-primary" disabled={guardandoEdit} onClick={guardar}>
                        {guardandoEdit ? "Guardando…" : "Guardar"}
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
                ) : (
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
                      <button type="button" className="btn-text" onClick={() => empezarEdicion(p)}>
                        Editar
                      </button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
