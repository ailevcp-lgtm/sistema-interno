function LoginField({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: string
}) {
  return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
      <div
        style={{
          display: 'flex',
          fontSize: 19,
          fontWeight: 600,
          color: '#252134',
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          height: 54,
          padding: '0 18px',
          borderRadius: 16,
          border: '1px solid rgba(104, 95, 124, 0.18)',
          backgroundColor: '#F8F6FA',
          color: '#7B738C',
          fontSize: 20,
        }}
      >
        <div
          style={{
            display: 'flex',
            width: 24,
            justifyContent: 'center',
            color: '#7B738C',
            fontWeight: 700,
          }}
        >
          {icon}
        </div>
        <div style={{ display: 'flex' }}>{value}</div>
      </div>
    </div>
  )
}

export function AileSocialPreview({ logoSrc }: { logoSrc: string }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        backgroundColor: '#F4F1F6',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          background:
            'radial-gradient(circle at left top, rgba(99,20,167,0.18), transparent 28%), radial-gradient(circle at right bottom, rgba(229,0,81,0.14), transparent 30%)',
        }}
      />

      <div
        style={{
          width: 960,
          height: 520,
          display: 'flex',
          gap: 28,
          position: 'relative',
        }}
      >
        <div
          style={{
            flex: '0 0 470px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: 30,
            borderRadius: 34,
            color: 'white',
            background:
              'linear-gradient(140deg, #6314A7 0%, #7D2BC0 52%, #E50051 100%)',
            boxShadow: '0 28px 60px rgba(90, 54, 117, 0.22)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            <div
              style={{
                display: 'flex',
                width: 70,
                height: 70,
                borderRadius: 22,
                overflow: 'hidden',
              }}
            >
              <img
                src={logoSrc}
                alt="AILE"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  fontSize: 44,
                  fontWeight: 800,
                  lineHeight: 1.04,
                }}
              >
                <span style={{ display: 'flex' }}>Sistema Interno</span>
                <span style={{ display: 'flex' }}>AILE</span>
              </div>

              <div
                style={{
                  display: 'flex',
                  maxWidth: 360,
                  fontSize: 18,
                  lineHeight: 1.4,
                  color: 'rgba(255,255,255,0.84)',
                }}
              >
                Administracion de socios, deudas, finanzas, tesoreria y
                documentos desde una unica plataforma.
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: 19,
                fontWeight: 700,
              }}
            >
              Acceso privado para miembros autorizados.
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 16,
                color: 'rgba(255,255,255,0.78)',
              }}
            >
              Si no puedes ingresar, contacta a la comision directiva.
            </div>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            padding: 30,
            borderRadius: 34,
            backgroundColor: 'rgba(255,255,255,0.92)',
            border: '1px solid rgba(104, 95, 124, 0.1)',
            boxShadow: '0 24px 50px rgba(94, 86, 112, 0.18)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontSize: 34,
                  fontWeight: 800,
                  color: '#252134',
                }}
              >
                Iniciar sesion
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: 17,
                  color: '#7B738C',
                }}
              >
                Ingresa con tu cuenta para acceder al panel interno.
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <LoginField
                label="Correo electronico"
                value="nombre@ejemplo.com"
                icon="@"
              />
              <LoginField
                label="Contrasena"
                value="••••••••"
                icon="*"
              />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 54,
                borderRadius: 16,
                background:
                  'linear-gradient(90deg, #6314A7 0%, #7D2BC0 52%, #E50051 100%)',
                color: 'white',
                fontSize: 22,
                fontWeight: 700,
                boxShadow: '0 16px 28px rgba(125, 43, 192, 0.24)',
              }}
            >
              Iniciar sesion
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                color: '#7B738C',
                fontSize: 14,
              }}
            >
              <div
                style={{
                  flex: 1,
                  height: 1,
                  backgroundColor: 'rgba(104, 95, 124, 0.18)',
                }}
              />
              <div style={{ display: 'flex' }}>o continuar con</div>
              <div
                style={{
                  flex: 1,
                  height: 1,
                  backgroundColor: 'rgba(104, 95, 124, 0.18)',
                }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                height: 54,
                borderRadius: 16,
                border: '1px solid rgba(104, 95, 124, 0.18)',
                color: '#252134',
                fontSize: 19,
                fontWeight: 700,
                backgroundColor: '#FFFFFF',
              }}
            >
              <span style={{ display: 'flex', color: '#4285F4' }}>G</span>
              <span style={{ display: 'flex' }}>Continuar con Google</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
