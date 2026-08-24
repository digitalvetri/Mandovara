"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { EntityForm } from "@/components/data/EntityForm";
import { updateProject } from "@/modules/projects/actions";

interface Initial {
  name:              string;
  orderValue:        string;
  expectedInstallAt: string;
  siteContactName:   string;
  siteContactMobile: string;
}

interface Props {
  id:      string;
  initial: Initial;
}

export function ProjectEditForm({ id, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const [name,              setName]              = useState(initial.name);
  const [orderValue,        setOrderValue]        = useState(initial.orderValue);
  const [expectedInstallAt, setExpectedInstallAt] = useState(initial.expectedInstallAt);
  const [siteContactName,   setSiteContactName]   = useState(initial.siteContactName);
  const [siteContactMobile, setSiteContactMobile] = useState(initial.siteContactMobile);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    startTransition(async () => {
      const result = await updateProject({
        id, name, orderValue, expectedInstallAt,
        siteContactName, siteContactMobile,
      });
      if (!result.ok) {
        setServerError(result.error ?? "Something went wrong");
        return;
      }
      router.push(`/projects/${id}` as Route);
      router.refresh();
    });
  }

  return (
    <EntityForm
      onSubmit={onSubmit}
      pending={pending}
      serverError={serverError}
      submitLabel="Save changes"
      onCancel={() => router.back()}
    >
      <EntityForm.Field label="Project name" required>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={EntityForm.fieldCls}
          autoFocus
        />
      </EntityForm.Field>
      <EntityForm.Field label="Order value" hint="e.g. 2,50,000 or 2.5L">
        <input
          value={orderValue}
          onChange={(e) => setOrderValue(e.target.value)}
          className={`${EntityForm.fieldCls} tabular`}
          inputMode="decimal"
        />
      </EntityForm.Field>
      <EntityForm.Field label="Expected install date">
        <input
          type="date"
          value={expectedInstallAt}
          onChange={(e) => setExpectedInstallAt(e.target.value)}
          className={EntityForm.fieldCls}
        />
      </EntityForm.Field>
      <EntityForm.Field label="Site contact name">
        <input
          value={siteContactName}
          onChange={(e) => setSiteContactName(e.target.value)}
          className={EntityForm.fieldCls}
        />
      </EntityForm.Field>
      <EntityForm.Field label="Site contact mobile" hint="10-digit mobile">
        <input
          value={siteContactMobile}
          onChange={(e) => setSiteContactMobile(e.target.value)}
          className={EntityForm.fieldCls}
          inputMode="tel"
        />
      </EntityForm.Field>
    </EntityForm>
  );
}
