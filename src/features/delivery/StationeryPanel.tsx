"use client";

import { useState } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import { Button, IconButton } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Panel } from "@/components/ui/Primitives";
import type { Project, StationeryDetails, StationeryPerson } from "@/types";
import { newId } from "@/utils/id";
import { stationeryDetails } from "./stationery/brand";

const KIT_CONTENTS =
  "Word letterhead, Excel invoice, print-ready business cards (one per person), envelope, compliment slip, PowerPoint template, email signatures, social media and video-call images, and the brand fonts.";

/**
 * Contact details for the stationery kit. Saved to the project as fields lose
 * focus, so the next download (and the logo package) uses them.
 */
export function StationeryPanel({
  project,
  save,
  onDownload,
  downloading,
}: {
  project: Project;
  save: (details: StationeryDetails) => Promise<void>;
  onDownload: (details: StationeryDetails) => void;
  downloading: boolean;
}) {
  const [draft, setDraft] = useState<StationeryDetails>(() => stationeryDetails(project));
  const [dirty, setDirty] = useState(false);

  const change = (patch: Partial<StationeryDetails>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };
  const changePerson = (id: string, patch: Partial<StationeryPerson>) =>
    change({ people: draft.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) });

  const commit = (next = draft) => {
    if (!dirty && next === draft) return;
    setDirty(false);
    void save(next);
  };

  const addPerson = () => {
    const next = {
      ...draft,
      people: [...draft.people, { id: newId("person"), name: "", title: "", phone: "", email: "" }],
    };
    setDraft(next);
    commit(next);
  };
  const removePerson = (id: string) => {
    const next = { ...draft, people: draft.people.filter((p) => p.id !== id) };
    setDraft(next);
    commit(next);
  };

  const text = (key: keyof StationeryDetails, label: string, placeholder: string, hint?: string) => (
    <Field label={label} hint={hint}>
      <Input
        value={draft[key] as string}
        placeholder={placeholder}
        onChange={(e) => change({ [key]: e.target.value })}
        onBlur={() => commit()}
      />
    </Field>
  );

  return (
    <Panel>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[14px] text-ink">Stationery kit</h3>
          <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-muted">{KIT_CONTENTS}</p>
          <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-muted">
            Built from the final logo and the brand kit&apos;s colours and typefaces. It is also
            included in the logo package.
          </p>
        </div>
        <Button
          variant="accent"
          size="sm"
          icon={<Download size={14} />}
          loading={downloading}
          onClick={() => {
            commit();
            onDownload(draft);
          }}
        >
          Download stationery
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Paper size" hint="Letterhead, invoice, cards and envelope">
          <Select
            value={draft.paper}
            onChange={(e) => {
              const next = { ...draft, paper: e.target.value as StationeryDetails["paper"] };
              setDraft(next);
              commit(next);
            }}
          >
            <option value="a4">A4 · 85 × 55 mm cards · DL envelope</option>
            <option value="letter">US Letter · 3.5 × 2 in cards · #10 envelope</option>
          </Select>
        </Field>
        {text("tagline", "Tagline", "Optional", "Banners and title slide")}
        {text("phone", "Company phone", "+1 555 010 0000")}
        {text("email", "Company email", "hello@example.com")}
        {text("website", "Website", "www.example.com")}
        {text("signatureLogoUrl", "Logo URL for email signatures", "https://…/logo.png", "Needed for Gmail")}
        <Field label="Address" hint="One line per row">
          <Textarea
            rows={3}
            value={draft.address}
            placeholder={"100 Example Street\nCity, Postcode\nCountry"}
            onChange={(e) => change({ address: e.target.value })}
            onBlur={() => commit()}
          />
        </Field>
        <Field label="Payment details" hint="Printed on the invoice">
          <Textarea
            rows={3}
            value={draft.paymentDetails}
            placeholder={"Bank name\nAccount name and number\nSWIFT / routing"}
            onChange={(e) => change({ paymentDetails: e.target.value })}
            onBlur={() => commit()}
          />
        </Field>
      </div>

      <div className="mt-6">
        <div className="mb-2.5 flex items-center justify-between">
          <p className="label-xs">People · business card and email signature each</p>
          <Button size="sm" variant="ghost" icon={<Plus size={13} />} onClick={addPerson}>
            Add person
          </Button>
        </div>
        {draft.people.length === 0 ? (
          <p className="text-[12px] text-muted">
            No one added yet: the kit will include one company business card.
          </p>
        ) : (
          <div className="space-y-2">
            {draft.people.map((person) => (
              <div key={person.id} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] items-center gap-2">
                {(
                  [
                    ["name", "Name"],
                    ["title", "Job title"],
                    ["phone", "Phone (else company)"],
                    ["email", "Email (else company)"],
                  ] as const
                ).map(([key, placeholder]) => (
                  <Input
                    key={key}
                    aria-label={placeholder}
                    value={person[key]}
                    placeholder={placeholder}
                    onChange={(e) => changePerson(person.id, { [key]: e.target.value })}
                    onBlur={() => commit()}
                  />
                ))}
                <IconButton
                  label={`Remove ${person.name || "person"}`}
                  tone="danger"
                  onClick={() => removePerson(person.id)}
                >
                  <Trash2 size={14} />
                </IconButton>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}
