// utils/parentescoColors.js
const normalize = (s = "") =>
    s
      .toString()
      .trim()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "") // quita acentos: "Cónyuge" -> "Conyuge"
      .toLowerCase();
  
  export const getTypeColor = (tipo = "") => {
    switch (normalize(tipo)) {
      case "tomador":
        return "primary";
      case "conyuge":
        return "info";
      case "hijo/a":
      case "hijo":
      case "hija":
        return "success";
      case "hermano":
      case "dependiente":
        return "secondary";
      case "padre":
        return "dark";
      case "madre":
        return "danger";
      case "nieto":
      case "nieto/a":
      case "nieta":
      case "abuelo":
      case "abuela":
      case "abuelo/a":
      case "suegro":
      case "suegra":
      case "suegro/a":
      case "tio":
      case "tia":
      case "tio/a":
      case "sobrino":
      case "sobrina":
      case "sobrino/a":
        return "warning";
      default:
        return "secondary";
    }
  };
  