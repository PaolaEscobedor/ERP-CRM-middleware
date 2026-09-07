/**
 * Sync Configuration: Products
 * ------------------------------------------------------
 * Source (Intelisis):  Table `Art`
 * Destination (Zoho):  Module `Products`
 * Direction:            Intelisis -> Zoho (one-way)
 */


module.exports = {
    sourceQuery: `SELECT Articulo, Descripcion1, Estatus, Unidad, Peso, Volumen,
                         Linea, Categoria, Familia, Grupo, Fabricante, Impuesto1
                  FROM Art WHERE Estatus = 'ALTA'`, // active products only

    sourceMap: {
        code: { source: 'Articulo' },
        name: { source: 'Descripcion1' },
        status: { source: 'Estatus' },
        unit: { source: 'Unidad' },
        weight: { source: 'Peso' },
        volume: { source: 'Volumen' },
        line: { source: 'Linea' },
        category: { source: 'Categoria' },
        family: { source: 'Familia' },
        group: { source: 'Grupo' },
        manufacturer: { source: 'Fabricante' },
        tax: { source: 'Impuesto1' }
    }, 

    zohoModule: 'Products',
    duplicateCheckFields: ['Product_Code'],

    // Reference catalogs that must already exist in Zoho before running this sync
    lookups: [
        { field: 'prod_line', canonical: 'line', zohoModule: 'prod_line' },
        { field: 'prod_category', canonical: 'category', zohoModule: 'prod_category' },
        { field: 'prod_family', canonical: 'family', zohoModule: 'prod_family' },
        { field: 'prod_group', canonical: 'group', zohoModule: 'prod_group' },
        { field: 'manufacturer_erp', canonical: 'manufacturer', zohoModule: 'prod_manufacturer' },
    ],


        destinationMap: {
        Product_Name: { canonical: 'name' },
        Product_Code: { canonical: 'code' },
        Usage_Unit: { canonical: 'unit' },
        Status: { canonical: 'status' },
        weight: { canonical: 'weight' },
        volume: { canonical: 'volume' },
        tax1: { canonical: 'tax1' },
        prod_line: { canonical: 'line', lookup: true },
        prod_category: { canonical: 'category', lookup: true },
        prod_family: { canonical: 'family', lookup: true },
        prod_group: { canonical: 'group', lookup: true },
        manufacturer_erp: { canonical: 'manufacturer', lookup: true },
    }
};



