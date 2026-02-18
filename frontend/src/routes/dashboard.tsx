import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LogOut, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PatientChatModal } from "@/components/chat/patient-chat-modal";
import { DeletePatientDialog } from "@/components/patients/delete-patient-dialog";
import {
  PatientFormDialog,
  type PatientFormValues,
} from "@/components/patients/patient-form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { signOut } from "@/lib/api/auth";
import { createPatient, deletePatient, listPatients, updatePatient } from "@/lib/api/patients";
import { getErrorMessage } from "@/lib/errors";
import { sessionQueryKey, sessionQueryOptions } from "@/lib/queries/auth";
import type { CreatePatientInput, Patient } from "@/lib/types/api";

const PATIENTS_PAGE_SIZE = 10;

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString();
}

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

export function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [deletingPatient, setDeletingPatient] = useState<Patient | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCursors, setPageCursors] = useState<Array<number | null>>([null]);

  const currentCursor = pageCursors[pageIndex] ?? null;

  const sessionQuery = useQuery(sessionQueryOptions);
  const patientsQuery = useQuery({
    queryKey: ["patients", PATIENTS_PAGE_SIZE, currentCursor],
    queryFn: () =>
      listPatients({
        limit: PATIENTS_PAGE_SIZE,
        cursor: currentCursor,
      }),
    placeholderData: keepPreviousData,
  });

  const createMutation = useMutation({
    mutationFn: createPatient,
  });

  const updateMutation = useMutation({
    mutationFn: (params: { id: number; payload: CreatePatientInput }) =>
      updatePatient(params.id, params.payload),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deletePatient(id),
  });

  const signOutMutation = useMutation({
    mutationFn: signOut,
  });

  const isMutatingPatients =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const canGoPrevious = pageIndex > 0;
  const canGoNext = Boolean(patientsQuery.data?.nextCursor);

  const patients = useMemo(() => patientsQuery.data?.data ?? [], [patientsQuery.data]);

  const resetPagination = () => {
    setPageCursors([null]);
    setPageIndex(0);
  };

  const refreshPatients = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["patients"],
    });
  };

  const handleCreatePatient = async (values: PatientFormValues) => {
    await createMutation.mutateAsync(values);
    toast.success("Patient created.");
    resetPagination();
    await refreshPatients();
  };

  const handleUpdatePatient = async (values: PatientFormValues) => {
    if (!editingPatient) {
      return;
    }

    await updateMutation.mutateAsync({
      id: editingPatient.id,
      payload: values,
    });
    toast.success("Patient updated.");
    await refreshPatients();
    setEditingPatient(null);
  };

  const handleDeletePatient = async (patient: Patient) => {
    await deleteMutation.mutateAsync(patient.id);
    toast.success("Patient deleted.");

    if (patients.length <= 1 && pageIndex > 0) {
      setPageIndex((current) => Math.max(0, current - 1));
    }

    await refreshPatients();
    setDeletingPatient(null);
  };

  const handleSignOut = async () => {
    try {
      await signOutMutation.mutateAsync();
    } finally {
      queryClient.setQueryData(sessionQueryKey, null);
      await navigate({ to: "/sign-in" });
    }
  };

  const handleNextPage = () => {
    const nextCursor = patientsQuery.data?.nextCursor;
    if (!nextCursor) {
      return;
    }

    const nextIndex = pageIndex + 1;
    setPageCursors((previous) => {
      const next = previous.slice(0, nextIndex);
      next[nextIndex] = nextCursor;
      return next;
    });
    setPageIndex(nextIndex);
  };

  const handlePreviousPage = () => {
    if (!canGoPrevious) {
      return;
    }

    setPageIndex((current) => current - 1);
  };

  return (
    <main className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-muted-foreground text-sm">Welcome back</p>
          <h1 className="font-semibold text-2xl tracking-tight">
            {sessionQuery.data?.user.name ?? "Patient dashboard"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            disabled={signOutMutation.isPending}
            className="gap-2"
          >
            <LogOut className="size-4" />
            {signOutMutation.isPending ? "Signing out..." : "Sign out"}
          </Button>
        </div>
      </header>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4" />
              Patients
            </CardTitle>
            <CardDescription>
              Manage records and open AI chat per patient.
            </CardDescription>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="size-4" />
            Add patient
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {patientsQuery.isError ? (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {getErrorMessage(patientsQuery.error, "Unable to load patients.")}
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>DOB</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patientsQuery.isPending
                  ? Array.from({ length: 5 }).map((_, index) => (
                      <TableRow key={`loading-${index}`}>
                        <TableCell>
                          <Skeleton className="h-4 w-28" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-40" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <div className="ml-auto flex w-fit gap-2">
                            <Skeleton className="h-8 w-14" />
                            <Skeleton className="h-8 w-14" />
                            <Skeleton className="h-8 w-14" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  : null}

                {!patientsQuery.isPending && patients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      No patients found.
                    </TableCell>
                  </TableRow>
                ) : null}

                {!patientsQuery.isPending &&
                  patients.map((patient) => (
                    <TableRow key={patient.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{patient.name}</p>
                          <p className="text-muted-foreground text-xs">
                            ID: {patient.id}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p>{patient.email}</p>
                        <p className="text-muted-foreground text-xs">{patient.phone}</p>
                      </TableCell>
                      <TableCell>{formatDate(patient.dob)}</TableCell>
                      <TableCell>{formatDateTime(patient.updatedAt)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <PatientChatModal patient={patient} />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingPatient(patient)}
                            disabled={isMutatingPatients}
                            className="gap-1"
                          >
                            <Pencil className="size-3.5" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDeletingPatient(patient)}
                            disabled={isMutatingPatients}
                            className="gap-1 border-destructive/40 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-muted-foreground text-sm">
              Page {pageIndex + 1}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={!canGoPrevious || patientsQuery.isFetching}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={!canGoNext || patientsQuery.isFetching}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <PatientFormDialog
        mode="create"
        open={isCreateOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreatePatient}
      />

      <PatientFormDialog
        mode="edit"
        open={editingPatient !== null}
        patient={editingPatient}
        onOpenChange={(open) => {
          if (!open) {
            setEditingPatient(null);
          }
        }}
        onSubmit={handleUpdatePatient}
      />

      <DeletePatientDialog
        open={deletingPatient !== null}
        patient={deletingPatient}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingPatient(null);
          }
        }}
        onConfirm={handleDeletePatient}
      />
    </main>
  );
}
