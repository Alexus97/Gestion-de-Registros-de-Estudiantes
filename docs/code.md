    // 1. String
    const texto = "Hola JavaScript";

    // 2. Number
    // const edad = 25;

    // 3. BigInt
    const numeroGrande = 9007199254740991n;

    // 4. Boolean
    const esActivo = true;

    // 5. Undefined
    let sinDefinir;

    // 6. Null
    const valorNulo = null;

    // 7. Symbol
    const idUnico = Symbol("id");

    // 8. Object
    const persona = {
      nombre: "Carlos",
      edad: 30
    };

    // Muestra por consola
    console.log("String:", texto, typeof texto);
    console.log("Number:", edad, typeof edad);
    console.log("BigInt:", numeroGrande, typeof numeroGrande);
    console.log("Boolean:", esActivo, typeof esActivo);
    console.log("Undefined:", sinDefinir, typeof sinDefinir);
    console.log("Null:", valorNulo, typeof valorNulo);
    console.log("Symbol:", idUnico, typeof idUnico);
    console.log("Object:", persona, typeof persona);



    // ==========================================
    // 1. VARIABLES, CONSTANTES Y DATOS NATIVOS
    // ==========================================
    // Explicación: Se define una constante inmutable para la tienda
    // y una variable para la lista de productos (tipo Array/Object).
    const NOMBRE_TIENDA = "TechStore";
    let inventario = [
      { nombre: "Laptop", precio: 800, enStock: true },
      { nombre: "Mouse", precio: 20, enStock: true },
      { nombre: "Teclado", precio: 50, enStock: false },
      { nombre: "Monitor", precio: 200, enStock: true }
    ];

    // console.log("=== BIENVENIDO A " + NOMBRE_TIENDA + " ===");
    console.log(`=== BIENVENIDO A " ${NOMBRE_TIENDA} ===`)

    // ==========================================
    // 2. FUNCIONES Y OPERADORES
    // ==========================================
    // Explicación: Esta función recibe un precio y aplica un descuento utilizando
    // operadores aritméticos (* y -) si el valor supera cierto umbral.
    function calcularPrecioConDescuento(precio) {
      const UMBRAL_DESCUENTO = 100; // Constante local
      const DESCUENTO = 0.10;       // 10% de descuento

      // Operador de comparación (>)
      if (precio > UMBRAL_DESCUENTO) {
        let precioFinal = precio - (precio * DESCUENTO);
        return precioFinal;
      }
      return precio;
    }

    // ==========================================
    // 3. CONDICIONALES Y CICLOS
    // ==========================================
    // Explicación: Usamos un ciclo 'for' para iterar sobre el inventario
    // y condicionales 'if/else' con operadores lógicos (&&) para filtrar productos.
    console.log("\n--- Procesando Inventario con Descuentos ---");

    for (let i = 0; i < inventario.length; i++) {
      let producto = inventario[i];

      // Condicional: Verifica si está disponible Y si su precio es mayor a 0
      if (producto.enStock === true && producto.precio > 0) {
        // Llamada a la función
        let precioCalculado = calcularPrecioConDescuento(producto.precio);

        console.log(`Producto: ${producto.nombre} | Precio Original: $${producto.precio} | Precio Final: $${precioCalculado}`);
      } else {
        console.log(`Producto: ${producto.nombre} | ESTADO: No disponible en stock.`);
      }
    }

    // ==========================================
    // 4. CICLO WHILE (Ejemplo adicional)
    // ==========================================
    // Explicación: Un ciclo 'while' que simula procesar una caja registradora
    // reduciendo un presupuesto inicial hasta que se agote o no alcance.
    console.log("\n--- Simulación de Compra con Presupuesto ---");
    let presupuesto = 850;
    let indice = 0;

    while (presupuesto > 0 && indice < inventario.length) {
      let item = inventario[indice];

      if (item.enStock && item.precio <= presupuesto) {
        presupuesto -= item.precio; // Operador de asignación resta (presupuesto = presupuesto - item.precio)
        console.log(`Comprado: ${item.nombre} por $${item.precio}. Presupuesto restante: $${presupuesto}`);
      }
      indice++; // Operador de incremento
    }
