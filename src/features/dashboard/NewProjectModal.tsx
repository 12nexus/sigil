"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Primitives";
import { projectRepository } from "@/services/db/repository";
import { createProject } from "@/workflows/projectFactory";
import { useToast } from "@/hooks/useToast";

/**
 * Deliberately minimal. The full picture is gathered by the adaptive discovery
 * interview, not by a long form at creation time.
 */
export function NewProjectModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setCompanyName("");
    setIndustry("");
    setDescription("");
    setError(null);
  };

  const submit = async () => {
    if (!companyName.trim()) {
      setError("A company name is required — it drives every wordmark we generate.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const project = createProject({ companyName, industry, description });
      await projectRepository.create(project);
      reset();
      onClose();
      router.push(`/projects/${project.id}/discovery`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the project.");
      push({ tone: "error", title: "Could not create project" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New project"
      description="Just enough to open the file. Discovery fills in the rest."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" onClick={submit} loading={creating}>
            Create and start discovery
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field
          label="Company name"
          required
          hint="Exact spelling and capitalisation"
        >
          <Input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Nexora"
            autoFocus
          />
        </Field>

        <Field label="Industry" hint="Optional">
          <Input
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="AI consulting for industrial operations"
          />
        </Field>

        <Field label="What does the company do?" hint="Optional — you can answer this in discovery">
          <Textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="They embed senior teams inside manufacturers to put machine learning into daily operations…"
          />
        </Field>

        {error ? <p className="text-[12px] text-danger">{error}</p> : null}
      </form>
    </Modal>
  );
}
