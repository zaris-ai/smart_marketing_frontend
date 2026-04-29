import { Html, Head, Main, NextScript } from "next/document";
import { yekan } from "@/lib/local_fonts";

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
