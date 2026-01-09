"use client";

import React from "react";
import styles from "./ProveedorInfoModal.module.css";

function ReadonlyField({ label, value }) {
  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      <input
        className={styles.input}
        value={value ?? ""}
        readOnly
      />
    </div>
  );
}

export default function ProveedorInfoModal({ proveedor, onClose }) {
  if (!proveedor) return null;

  const bank = proveedor.BankInfo || {};

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* HEADER */}
        <header className={styles.header}>
          <h2 className={styles.title}>Información del proveedor</h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
          >
            ✕
          </button>
        </header>

        {/* CONTENIDO SCROLLEABLE */}
        <div className={styles.content}>
          {/* IDENTIFICACIÓN */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Identificación</div>
            <div className={styles.grid}>
              <ReadonlyField label="Código SAP" value={proveedor.CardCode} />
              <ReadonlyField label="Nombre" value={proveedor.CardName} />
              <ReadonlyField label="País" value={proveedor.Country} />
              <ReadonlyField
                label="Grupo"
                value={String(proveedor.GroupCode ?? "")}
              />
            </div>
          </div>

          {/* CONTACTO */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Contacto</div>
            <div className={styles.grid}>
              <ReadonlyField label="Dirección" value={proveedor.Address} />
              <ReadonlyField label="Teléfono 1" value={proveedor.Phone1} />
              <ReadonlyField label="Teléfono 2" value={proveedor.Phone2} />
              <ReadonlyField label="Correo" value={proveedor.MailAddres} />
            </div>
          </div>

          {/* CONDICIONES DE PAGO */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Condiciones de pago</div>
            <div className={styles.grid}>
              <ReadonlyField
                label="Condición de pago"
                value={proveedor.PayTermsName}
              />
              <ReadonlyField
                label="Días de crédito"
                value={
                  proveedor.GroupNum != null
                    ? String(proveedor.GroupNum)
                    : ""
                }
              />
              <ReadonlyField
                label="Forma de pago (U_SYP_FPAGO)"
                value={proveedor.U_SYP_FPAGO}
              />
            </div>
          </div>

          {/* DATOS BANCARIOS */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Datos bancarios</div>
            <div className={styles.grid}>
              <ReadonlyField label="Banco" value={bank.BankCode} />
              <ReadonlyField
                label="Nombre cuenta"
                value={bank.AccountName}
              />
              <ReadonlyField
                label="Número cuenta"
                value={bank.AccountNo}
              />
              <ReadonlyField
                label="Tipo identificación"
                value={bank.IdType}
              />
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={onClose}
          >
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
}
