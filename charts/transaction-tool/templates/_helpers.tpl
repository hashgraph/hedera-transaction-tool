{{- define "transactiontool.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Common labels
*/}}
{{- define "common.labels" -}}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: transaction-tool
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
helm.sh/chart: {{ include "transactiontool.chart" . }}
{{- if .Values.global.labels }}
{{ toYaml .Values.global.labels }}
{{- end }}
{{- end -}}

{{/*
Common annotations
*/}}
{{- define "common.annotations" -}}
{{- if .Values.global.annotations -}}
{{- toYaml .Values.global.annotations -}}
{{- end -}}
{{- end -}}


{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "transactiontool.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s" .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}


{{- define "transactiontool.sqlHost" -}}
{{ coalesce .Values.postgres.host (printf "%s-pg-rw.%s.svc" (include "transactiontool.fullname" .) .Release.Namespace) (printf "%s-citus.%s.svc" (include "transactiontool.fullname" .) .Release.Namespace) | squote }}
{{- end -}}

{{- define "transactiontool.redisUrl" -}}
{{ coalesce .Values.redis.url (printf "redis://%s-redis-ha.%s.svc" (include "transactiontool.fullname" .) .Release.Namespace) | squote }}
{{- end -}}
