import moment from 'moment';

export const formatDateTime = (date) => {
    if (!date) return '-';
    return moment(date).format('DD MMM YYYY, HH:mm');
};

export const formatDate = (date) => {
    if (!date) return '-';
    return moment(date).format('DD MMMM YYYY');
};
