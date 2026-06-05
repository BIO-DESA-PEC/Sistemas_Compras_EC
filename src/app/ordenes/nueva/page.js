import OCEditor from "../[id]/ui/OCEditor";
export default function NuevaOrdenPage() {
  const ocNueva = {
    IdOC: null,
    IdSolicitud: null,
    IdPreOC: null,
    Estado: "GENERADA",
    Tipo: "SERVICIO",
    FormaPago: "20",
    DiasPago: 0,
    EsMensual: "N",
    Comentario: "OC DIRECTA",
  };

  const detalleInicial = [
    {
      NumeroArticulo: "",
      Proveedor: "",
      ProveedorCardCode: "",
      FechaNecesaria: "",
      Cantidad: 1,
      Precio: 0,
      Descuento: 0,
      IvaPct: 15,
      Iva: 0,
      Total: 0,
      DiasPago: 0,
    },
  ];

  return (
    <OCEditor
      oc={ocNueva}
      detalleInicial={detalleInicial}
      modoDirecto={true}
    />
  );
}