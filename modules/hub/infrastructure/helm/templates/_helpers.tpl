{{/* vim: set filetype=mustache: */}}
{{/*
Expand the name of the chart.
*/}}
{{- define "spankchain-hub.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
*/}}
{{- define "spankchain-hub.fullname" -}}
{{- printf "%s" .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "sc_hub_env" }}
{{- if .Values.local.postgresql }}
- name: PGHOST
  value: {{ .Release.Name }}-postgresql
- name: PGDATABASE
  value: hub
- name: PGUSER
  value: {{.Values.postgresql.postgresUser}}
- name: PGPASSWORD
  value: {{ quote .Values.postgresql.postgresPassword}}
{{- else }}
- name: PGDATABASE
  value: hub
- name: PGHOST
  value: '{{ .Values.pgHost }}'
- name: PGUSER
  valueFrom:
    secretKeyRef:
      name: {{ .Values.pgSecretName }}
      key: username
- name: PGPASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ .Values.pgSecretName }}
      key: password
{{- end }}
- name: DATABASE_URL
  value: 'postgresql://$(PGUSER):$(PGPASSWORD)@$(PGHOST)/$(PGDATABASE)'
{{- if .Values.local.redis }}
- name: REDIS_URL
  value: 'redis://{{ .Release.Name }}-redis:6379'
{{- end }}
{{- range $key, $value := .Values.env }}
- name: {{ $key }}
  value: {{ $value | quote }}
{{- end}}
{{- if .Values.env_secrets }}
{{- range $key, $value := .Values.env_secrets }}
{{- $bits := split "." $value }}
- name: {{ $key }}
  valueFrom:
    secretKeyRef:
      name: {{ $bits._0 | quote }}
      key: {{ $bits._1 | quote }}
{{- end}}
{{- end}}
{{- end}}
