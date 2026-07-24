import type { Metadata } from "next";
import { HomePage } from "@/components/home-page";
import { JsonLd } from "@/components/json-ld";
import { getSeriesList } from "@/lib/server-api";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "웹툰을 읽고 단행본으로 소장하는 곳",
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

export default async function Home() {
  const data = await getSeriesList();

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: SITE_NAME,
          alternateName: "스위트툰",
          url: SITE_URL,
          description: SITE_DESCRIPTION,
          inLanguage: "ko-KR",
        }}
      />
      <HomePage initialData={data} />
    </>
  );
}
