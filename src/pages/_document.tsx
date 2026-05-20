import { yekan } from "@/lib/local_fonts";
import { Head, Html, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="fa" dir="ltr" className={yekan.variable} data-theme="light">
      <Head />
      <body className="antialiased font-sans bg-base-100 text-base-content">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
