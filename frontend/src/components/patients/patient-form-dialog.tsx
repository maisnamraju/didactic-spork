import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/errors";
import type { CreatePatientInput, Patient } from "@/lib/types/api";

function isValidDateString(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const patientFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Name is too long"),
  email: z
    .string()
    .trim()
    .email("Email must be valid")
    .transform((value) => value.toLowerCase()),
  phone: z
    .string()
    .trim()
    .min(7, "Phone must be at least 7 characters")
    .max(20, "Phone must be at most 20 characters")
    .regex(/^[+0-9()\-\s]+$/, "Phone contains invalid characters"),
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "DOB must be in YYYY-MM-DD format")
    .refine((value) => isValidDateString(value), "DOB must be a valid calendar date"),
  medicalNotes: z
    .string()
    .trim()
    .min(1, "Medical notes are required")
    .max(10_000, "Medical notes are too long"),
});

export type PatientFormValues = z.infer<typeof patientFormSchema>;

interface PatientFormDialogProps {
  mode: "create" | "edit";
  open: boolean;
  patient?: Patient | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: CreatePatientInput) => Promise<void>;
}

const EMPTY_VALUES: PatientFormValues = {
  name: "",
  email: "",
  phone: "",
  dob: "",
  medicalNotes: "",
};

export function PatientFormDialog({
  mode,
  open,
  patient,
  onOpenChange,
  onSubmit,
}: PatientFormDialogProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    if (mode === "edit" && patient) {
      form.reset({
        name: patient.name,
        email: patient.email,
        phone: patient.phone,
        dob: patient.dob,
        medicalNotes: patient.medicalNotes,
      });
    } else {
      form.reset(EMPTY_VALUES);
    }

  }, [form, mode, open, patient]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSubmitError(null);
    }

    onOpenChange(nextOpen);
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);

    try {
      await onSubmit(values);
      handleOpenChange(false);
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    }
  });

  const isSubmitting = form.formState.isSubmitting;
  const title = mode === "create" ? "Create patient" : "Edit patient";
  const description =
    mode === "create"
      ? "Add a new patient record to your dashboard."
      : "Update patient details.";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Jane Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="jane@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+1 (202) 555-0101" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dob"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of birth</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="medicalNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Medical notes</FormLabel>
                  <FormControl>
                    <Textarea rows={6} placeholder="Enter medical context..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {submitError ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {submitError}
              </div>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : mode === "create" ? "Create patient" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
