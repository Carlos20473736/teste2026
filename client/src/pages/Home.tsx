import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * Home redireciona para /spin por padrão (mantém compatibilidade com a rota /).
 * Preserva query string (?ymid=...) no redirecionamento.
 */
export default function Home() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const search = window.location.search;
    setLocation("/spin" + search);
  }, [setLocation]);

  return null;
}
