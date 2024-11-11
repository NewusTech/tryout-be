module.exports.generatePagination = (totalItems, currentPage, perPage, baseUrl) => {
    const totalPages = Math.ceil(totalItems / perPage);

    const pagination = {
        page: currentPage,
        perPage: perPage,
        totalPages: totalPages,
        totalCount: totalItems,
        links: {
            prev: currentPage > 1 ? `${baseUrl}?page=${currentPage - 1}&limit=${perPage}` : null,
            next: currentPage < totalPages ? `${baseUrl}?page=${currentPage + 1}&limit=${perPage}` : null
        }
    };

    return pagination;
};