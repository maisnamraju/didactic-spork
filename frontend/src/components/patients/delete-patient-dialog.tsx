import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getErrorMessage } from "@/lib/errors";
import type { Patient } from "@/lib/types/api";

interface DeletePatientDialogProps {
  open: boolean;
  patient: Patient | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (patient: Patient) => Promise<void>;
}

export function DeletePatientDialog({
  open,
  patient,
  onOpenChange,
  onConfirm,
}: DeletePatientDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setErrorMessage(null);
    }
  }, [open]);

  const handleDelete = async () => {
    if (!patient || isDeleting) {
      return;
    }

    setErrorMessage(null);
    setIsDeleting(true);

    try {
      await onConfirm(patient);
      onOpenChange(false);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete patient record?</AlertDialogTitle>
          <AlertDialogDescription>
            This performs a soft-delete for <strong>{patient?.name ?? "this patient"}</strong>.
            The record and chat history will no longer appear in active views.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {errorMessage ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              void handleDelete();
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Deleting..." : "Delete patient"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
