"use client";

import { forwardRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import styles from "./anticipoNew.module.css";

function esViernes(date) {
  return date.getDay() === 5;
}

function isoDeFecha(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fechaDeIso(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const CampoTexto = forwardRef(function CampoTexto({ value, onClick, placeholder }, ref) {
  return (
    <input
      readOnly
      className={styles.fechaPagoInput}
      onClick={onClick}
      ref={ref}
      value={value || ""}
      placeholder={placeholder}
    />
  );
});

export default function FechaPagoPicker({ value, onChange, minDate }) {
  return (
    <DatePicker
      selected={fechaDeIso(value)}
      onChange={(date) => onChange(date ? isoDeFecha(date) : "")}
      filterDate={esViernes}
      minDate={minDate ? fechaDeIso(minDate) : new Date()}
      dateFormat="dd/MM/yyyy"
      placeholderText="Selecciona un viernes"
      customInput={<CampoTexto />}
      wrapperClassName={styles.fechaPagoWrapper}
    />
  );
}
